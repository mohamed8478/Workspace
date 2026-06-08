# Hidden LiveKit STT agent posting transcripts to Spring Boot (Groq).
import os
import asyncio
from collections import deque
import aiohttp
from datetime import datetime, timedelta, timezone

from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
INGEST_URL = f"{BACKEND_URL}/api/transcripts/ingest"

GROQ_API_KEY = (os.getenv("GROQ_API_KEY") or "").strip()
GROQ_MODEL = (os.getenv("GROQ_MODEL", "whisper-large-v3-turbo") or "whisper-large-v3-turbo").strip()
GROQ_LANGUAGE = (os.getenv("GROQ_LANGUAGE", "") or "").strip()

CHUNK_SECONDS = float(os.getenv("GROQ_CHUNK_SECONDS", "2"))
OVERLAP_SECONDS = float(os.getenv("GROQ_OVERLAP_SECONDS", "0.5"))
MAX_CONCURRENT_REQUESTS = int(os.getenv("GROQ_MAX_CONCURRENT", "2"))


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


async def groq_transcribe(session, wav_bytes, language):
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is required")

    form = aiohttp.FormData()
    form.add_field("file", wav_bytes, filename="audio.wav", content_type="audio/wav")
    form.add_field("model", GROQ_MODEL)
    if language:
        form.add_field("language", language)

    async with session.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        data=form,
    ) as resp:
        if resp.status >= 400:
            body = await resp.text()
            raise RuntimeError(f"Groq STT failed: {resp.status} {body}")
        data = await resp.json()
        return data.get("text", "").strip()


async def entrypoint(ctx: JobContext):
    print(f"[agent] BACKEND_URL={BACKEND_URL}")
    await ctx.connect(auto_subscribe=True)
    print(f"[agent] connected to room: {ctx.room.name}")

    http_session = aiohttp.ClientSession()

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
            frames = deque()
            duration = 0.0
            semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
            pending = set()

            async def transcribe_chunk(chunk_frames, chunk_duration):
                async with semaphore:
                    wav_bytes = rtc.combine_audio_frames(list(chunk_frames)).to_wav_bytes()
                    end_time = datetime.now(timezone.utc)
                    start_time = end_time - timedelta(seconds=chunk_duration)

                    text = await groq_transcribe(http_session, wav_bytes, GROQ_LANGUAGE)
                    if text:
                        print(f"[agent] posting transcript: {text}")
                        await post_transcript(
                            http_session,
                            ctx.room.name,
                            participant.identity,
                            text,
                            start_time,
                            end_time,
                        )

            async for frame_event in audio_stream:
                frame = frame_event.frame
                frames.append(frame)
                duration += frame.duration

                if duration >= CHUNK_SECONDS:
                    chunk_frames = list(frames)
                    chunk_duration = duration

                    task = asyncio.create_task(transcribe_chunk(chunk_frames, chunk_duration))
                    pending.add(task)
                    task.add_done_callback(pending.discard)

                    # keep a small overlap to avoid cutting words
                    overlap_frames = deque()
                    overlap_duration = 0.0
                    while frames and overlap_duration < OVERLAP_SECONDS:
                        tail = frames.pop()
                        overlap_frames.appendleft(tail)
                        overlap_duration += tail.duration

                    frames = overlap_frames
                    duration = overlap_duration

            if frames:
                task = asyncio.create_task(transcribe_chunk(list(frames), duration))
                pending.add(task)
                task.add_done_callback(pending.discard)

            if pending:
                await asyncio.gather(*pending)

        asyncio.create_task(run_stt())

    @ctx.room.on("disconnected")
    def on_disconnect():
        asyncio.create_task(http_session.close())


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="stt-agent"))
