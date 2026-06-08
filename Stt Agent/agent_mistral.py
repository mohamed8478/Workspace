# Hidden LiveKit STT agent posting transcripts to Spring Boot (Mistral realtime).
import os
import asyncio
import queue
import threading
import time
from datetime import datetime, timezone

import aiohttp
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli

from mistralai.client import Mistral
from mistralai.client.models import (
    AudioFormat,
    RealtimeTranscriptionError,
    RealtimeTranscriptionSessionCreated,
    TranscriptionStreamDone,
    TranscriptionStreamTextDelta,
)
from mistralai.extra.realtime import UnknownRealtimeEvent


BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
INGEST_URL = f"{BACKEND_URL}/api/transcripts/ingest"

MISTRAL_API_KEY = (os.getenv("MISTRAL_API_KEY") or "").strip()
MISTRAL_MODEL = (
    os.getenv("MISTRAL_MODEL", "voxtral-mini-transcribe-realtime-2602")
    or "voxtral-mini-transcribe-realtime-2602"
).strip()
MISTRAL_TARGET_DELAY_MS = int(os.getenv("MISTRAL_TARGET_DELAY_MS", "1000"))


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


async def queue_audio_iter(audio_q: asyncio.Queue):
    while True:
        chunk = await audio_q.get()
        if chunk is None:
            break
        yield chunk


async def entrypoint(ctx: JobContext):
    if not MISTRAL_API_KEY:
        raise RuntimeError("MISTRAL_API_KEY is required")

    print(f"[agent] BACKEND_URL={BACKEND_URL}")
    await ctx.connect(auto_subscribe=True)
    print(f"[agent] connected to room: {ctx.room.name}")

    http_session = aiohttp.ClientSession()
    audio_format = AudioFormat(encoding="pcm_s16le", sample_rate=16000)
    client = Mistral(api_key=MISTRAL_API_KEY)

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

        async def run_stt():
            audio_q: asyncio.Queue = asyncio.Queue(maxsize=200)
            loop = asyncio.get_running_loop()

            async def read_audio():
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
                            await audio_q.put(rf.data.tobytes())
                    else:
                        await audio_q.put(frame.data.tobytes())

                if resampler is not None:
                    for rf in resampler.flush():
                        await audio_q.put(rf.data.tobytes())

                await audio_q.put(None)

            async def run_transcription():
                buffer_text = ""
                last_flush = time.monotonic()
                flush_interval = 3.0

                async for event in client.audio.realtime.transcribe_stream(
                    audio_stream=queue_audio_iter(audio_q),
                    model=MISTRAL_MODEL,
                    audio_format=audio_format,
                    target_streaming_delay_ms=MISTRAL_TARGET_DELAY_MS,
                ):
                    if isinstance(event, RealtimeTranscriptionSessionCreated):
                        print("[agent] Mistral session created")
                        continue

                    if isinstance(event, TranscriptionStreamTextDelta):
                        buffer_text += event.text
                        now = time.monotonic()
                        if now - last_flush >= flush_interval and buffer_text.strip():
                            end_time = datetime.now(timezone.utc)
                            start_time = end_time
                            text = buffer_text.strip()
                            buffer_text = ""
                            last_flush = now
                            await post_transcript(
                                http_session,
                                ctx.room.name,
                                participant.identity,
                                text,
                                start_time,
                                end_time,
                            )
                        continue

                    if isinstance(event, TranscriptionStreamDone):
                        if buffer_text.strip():
                            end_time = datetime.now(timezone.utc)
                            start_time = end_time
                            await post_transcript(
                                http_session,
                                ctx.room.name,
                                participant.identity,
                                buffer_text.strip(),
                                start_time,
                                end_time,
                            )
                        print("[agent] Mistral transcription done")
                        break

                    if isinstance(event, RealtimeTranscriptionError):
                        print(f"[agent] Mistral error: {event}")
                        break

                    if isinstance(event, UnknownRealtimeEvent):
                        continue

            await asyncio.gather(read_audio(), run_transcription())

        asyncio.create_task(run_stt())

    @ctx.room.on("disconnected")
    def on_disconnect():
        asyncio.create_task(http_session.close())


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="stt-agent"))
