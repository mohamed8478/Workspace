# Hidden LiveKit STT agent posting transcripts to Spring Boot (Soniox).
import os
import asyncio
import threading
import queue
import aiohttp
from datetime import datetime, timezone

from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli

from soniox import SonioxClient
from soniox.types import RealtimeSTTConfig

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
INGEST_URL = f"{BACKEND_URL}/api/transcripts/ingest"

SONIOX_API_KEY = (os.getenv("SONIOX_API_KEY") or "").strip()
SONIOX_MODEL = (os.getenv("SONIOX_MODEL", "stt-rt-v4") or "stt-rt-v4").strip()
SONIOX_LANGUAGE_HINTS = (os.getenv("SONIOX_LANGUAGE_HINTS", "en") or "en").strip()
SONIOX_ENABLE_LID = (os.getenv("SONIOX_ENABLE_LID", "true") or "true").strip().lower() == "true"
SONIOX_ENABLE_ENDPOINTING = (
    (os.getenv("SONIOX_ENABLE_ENDPOINTING", "true") or "true").strip().lower() == "true"
)


async def post_transcript(session, room_name, participant_identity, text, start_time, end_time):
    payload = {
        "roomName": room_name,
        "participantIdentity": participant_identity,
        "text": text,
        "speechStartedAt": start_time.isoformat().replace("+00:00", "Z"),
        "speechEndedAt": end_time.isoformat().replace("+00:00", "Z"),
    }
    async with session.post(INGEST_URL, json=payload) as resp:
        if resp.status >= 400:
            body = await resp.text()
            raise RuntimeError(f"Ingest failed: {resp.status} {body}")


def build_config() -> RealtimeSTTConfig:
    language_hints = [x.strip() for x in SONIOX_LANGUAGE_HINTS.split(",") if x.strip()]

    config = RealtimeSTTConfig(
        model=SONIOX_MODEL,
        language_hints=language_hints,
        enable_language_identification=SONIOX_ENABLE_LID,
        enable_endpoint_detection=SONIOX_ENABLE_ENDPOINTING,
    )

    config.audio_format = "pcm_s16le"
    config.sample_rate = 16000
    config.num_channels = 1
    return config


async def entrypoint(ctx: JobContext):
    if not SONIOX_API_KEY:
        raise RuntimeError("SONIOX_API_KEY is required")

    print(f"[agent] BACKEND_URL={BACKEND_URL}")
    await ctx.connect(auto_subscribe=True)
    print(f"[agent] connected to room: {ctx.room.name}")

    http_session = aiohttp.ClientSession()

    def subscribe_existing_tracks():
        for participant in ctx.room.remote_participants.values():
            print(f"[agent] existing participant: {participant.identity}")
            for publication in participant.track_publications.values():
                print(f"[agent] existing track: {publication.kind} by {participant.identity}")
                try:
                    publication.set_subscribed(True)
                except Exception as exc:
                    print(f"[agent] subscribe failed: {exc}")

    subscribe_existing_tracks()

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        print(f"[agent] participant_connected: {participant.identity}")
        for publication in participant.track_publications.values():
            try:
                publication.set_subscribed(True)
            except Exception as exc:
                print(f"[agent] subscribe failed: {exc}")

    @ctx.room.on("track_published")
    def on_track_published(publication, participant):
        print(f"[agent] track_published: {publication.kind} by {participant.identity}")
        try:
            publication.set_subscribed(True)
        except Exception as exc:
            print(f"[agent] subscribe failed: {exc}")

    @ctx.room.on("track_subscribed")
    def on_track(track, publication, participant):
        print(f"[agent] track_subscribed: {track.kind} from {participant.identity}")
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return

        audio_stream = rtc.AudioStream(track)
        loop = asyncio.get_running_loop()

        def session_worker(audio_q: queue.Queue):
            os.environ["SONIOX_API_KEY"] = SONIOX_API_KEY
            client = SonioxClient()
            config = build_config()

            with client.realtime.stt.connect(config=config) as session:
                stop_event = threading.Event()

                def sender():
                    while not stop_event.is_set():
                        data = audio_q.get()
                        if data is None:
                            break
                        try:
                            session.send_byte_chunk(data)
                        except Exception as exc:
                            print(f"[agent] Soniox send failed: {exc}")
                            stop_event.set()
                            break

                sender_thread = threading.Thread(target=sender, daemon=True)
                sender_thread.start()

                final_text = ""
                for event in session.receive_events():
                    if getattr(event, "error_code", None):
                        print(f"[agent] Soniox error: {event.error_code} - {event.error_message}")
                        continue

                    new_final = []
                    for token in getattr(event, "tokens", []):
                        if getattr(token, "is_final", False):
                            new_final.append(token.text)

                    if new_final:
                        final_text += "".join(new_final)
                        text = final_text.strip()
                        if text:
                            end_time = datetime.now(timezone.utc)
                            start_time = end_time
                            fut = asyncio.run_coroutine_threadsafe(
                                post_transcript(
                                    http_session,
                                    ctx.room.name,
                                    participant.identity,
                                    text,
                                    start_time,
                                    end_time,
                                ),
                                loop,
                            )
                            try:
                                fut.result()
                            except Exception as exc:
                                print(f"[agent] post_transcript failed: {exc}")

                    if getattr(event, "finished", False):
                        break

                stop_event.set()
                audio_q.put(None)
                sender_thread.join(timeout=1)

        async def run_stt():
            audio_q: queue.Queue = queue.Queue()
            worker_thread = threading.Thread(
                target=session_worker, args=(audio_q,), daemon=True
            )
            worker_thread.start()

            resampler = None
            target_sr = 16000

            async for frame_event in audio_stream:
                frame = frame_event.frame
                if resampler is None and frame.sample_rate != target_sr:
                    resampler = rtc.AudioResampler(
                        frame.sample_rate,
                        target_sr,
                        quality=rtc.AudioResamplerQuality.HIGH,
                    )
                    print(f"[agent] resampling {frame.sample_rate} -> {target_sr}")

                if resampler is not None:
                    for rf in resampler.push(frame):
                        audio_q.put(rf.data.tobytes())
                else:
                    audio_q.put(frame.data.tobytes())

            if resampler is not None:
                for rf in resampler.flush():
                    audio_q.put(rf.data.tobytes())

            audio_q.put(None)
            worker_thread.join(timeout=1)

        asyncio.create_task(run_stt())

    @ctx.room.on("disconnected")
    def on_disconnect():
        asyncio.create_task(http_session.close())


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="stt-agent"))
