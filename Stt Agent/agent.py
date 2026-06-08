# Hidden LiveKit STT agent posting transcripts to Spring Boot.
import os
import json
import asyncio
import aiohttp
from datetime import datetime, timezone

from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.plugins import deepgram

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
DG_MODEL = os.getenv("DEEPGRAM_MODEL", "nova-2")
DG_LANGUAGE = os.getenv("DEEPGRAM_LANGUAGE", "fr")
INGEST_URL = f"{BACKEND_URL}/api/transcripts/ingest"

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

async def entrypoint(ctx: JobContext):
    print(f"[agent] BACKEND_URL={BACKEND_URL}")
    await ctx.connect(auto_subscribe=True)
    print(f"[agent] connected to room: {ctx.room.name}")
    @ctx.room.on("participant_connected")
    def on_participant(participant):
        print(f"[agent] participant_connected: {participant.identity}")

    @ctx.room.on("track_published")
    def on_track_published(publication, participant):
        print(f"[agent] track_published: {publication.kind} by {participant.identity}")
        try:
            publication.set_subscribed(True)
        except Exception as exc:
            print(f"[agent] subscribe failed: {exc}")

    stt = deepgram.STT(
        model=DG_MODEL,
        language=DG_LANGUAGE,
        detect_language=False,
        smart_format=True,
        punctuate=True,
        interim_results=False,
        endpointing_ms=150,
        sample_rate=16000
    )

    http_session = aiohttp.ClientSession()

    @ctx.room.on("track_subscribed")
    def on_track(track, publication, participant):
        print(f"[agent] track_subscribed: {track.kind} from {participant.identity}")
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return

        audio_stream = rtc.AudioStream(track)

        async def run_stt():
            print("[agent] starting Deepgram stream")
            stream = stt.stream(language=DG_LANGUAGE)

            async def push_audio():
                async for frame_event in audio_stream:
                    stream.push_frame(frame_event.frame)
                stream.end_input()

            async def read_events():
                async for event in stream:
                    print("[agent] deepgram event", event)
                    if event.type.name != "FINAL_TRANSCRIPT":
                        continue
                    if not event.alternatives:
                        continue
                    text = event.alternatives[0].text.strip()
                    if not text:
                        continue

                    started = datetime.fromtimestamp(event.alternatives[0].start_time, tz=timezone.utc)
                    ended = datetime.fromtimestamp(event.alternatives[0].end_time, tz=timezone.utc)

                    print(f"[agent] posting transcript: {text}")
                    await post_transcript(
                        http_session,
                        ctx.room.name,
                        participant.identity,
                        text,
                        started,
                        ended
                    )

            await asyncio.gather(push_audio(), read_events())

        asyncio.create_task(run_stt())

    @ctx.room.on("disconnected")
    def on_disconnect():
        asyncio.create_task(http_session.close())





if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint,
                              agent_name="stt-agent"))
