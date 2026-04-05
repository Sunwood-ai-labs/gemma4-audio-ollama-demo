from __future__ import annotations

import base64
import time
import uuid
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

VOICEVOX_BASE_URL = "http://127.0.0.1:50021"
OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "gemma4:e2b"
DEFAULT_SPEAKER = 2
ANSWER_PROMPT = (
    "Answer the spoken question in Japanese with one short natural sentence "
    "as if you were the person being asked. Do not say you are an AI. "
    "Do not mention limitations. Do not transcribe the audio. "
    "Do not repeat the question. Do not add explanations."
)

app = FastAPI(title="Gemma Voice Loop", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthService(BaseModel):
    ok: bool
    version: str | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    voicevox: HealthService
    ollama: HealthService
    model_available: bool
    checked_at: str


class SpeakerStyle(BaseModel):
    speaker_uuid: str
    speaker_name: str
    style_name: str
    style_id: int


class ChainRequest(BaseModel):
    text: str = Field(min_length=1, max_length=240)
    question_speaker: int = DEFAULT_SPEAKER
    answer_speaker: int = DEFAULT_SPEAKER
    model: str = DEFAULT_MODEL
    temperature: float = Field(default=0.0, ge=0.0, le=1.0)


class ChainResponse(BaseModel):
    request_id: str
    question_text: str
    answer_text: str
    model: str
    question_audio_data_url: str
    answer_audio_data_url: str
    timings: dict[str, int]


def audio_data_url(wav_bytes: bytes) -> str:
    encoded = base64.b64encode(wav_bytes).decode("ascii")
    return f"data:audio/wav;base64,{encoded}"


async def voicevox_synthesize(
    client: httpx.AsyncClient, text: str, speaker: int
) -> bytes:
    query_response = await client.post(
        f"{VOICEVOX_BASE_URL}/audio_query",
        params={"text": text, "speaker": speaker},
    )
    query_response.raise_for_status()
    query_payload = query_response.json()

    synthesis_response = await client.post(
        f"{VOICEVOX_BASE_URL}/synthesis",
        params={"speaker": speaker},
        json=query_payload,
    )
    synthesis_response.raise_for_status()
    return synthesis_response.content


async def gemma_answer(
    client: httpx.AsyncClient, wav_bytes: bytes, model: str, temperature: float
) -> str:
    audio_base64 = base64.b64encode(wav_bytes).decode("ascii")
    payload = {
        "model": model,
        "prompt": ANSWER_PROMPT,
        "images": [audio_base64],
        "stream": False,
        "options": {"temperature": temperature},
    }
    response = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
    response.raise_for_status()
    data = response.json()
    answer = str(data.get("response", "")).strip()
    if not answer:
        raise HTTPException(
            status_code=502,
            detail="Gemma returned an empty response for the generated question audio.",
        )
    return answer


async def ollama_model_available(client: httpx.AsyncClient, model: str) -> bool:
    response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
    response.raise_for_status()
    data = response.json()
    models = data.get("models", [])
    return any(item.get("name") == model for item in models)


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    voicevox = HealthService(ok=False)
    ollama = HealthService(ok=False)
    model_available = False

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            response = await client.get(f"{VOICEVOX_BASE_URL}/version")
            response.raise_for_status()
            voicevox = HealthService(ok=True, version=response.text.strip('"'))
        except Exception as exc:
            voicevox = HealthService(ok=False, error=str(exc))

        try:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/version")
            response.raise_for_status()
            data = response.json()
            ollama = HealthService(ok=True, version=data.get("version"))
            model_available = await ollama_model_available(client, DEFAULT_MODEL)
        except Exception as exc:
            ollama = HealthService(ok=False, error=str(exc))

    return HealthResponse(
        voicevox=voicevox,
        ollama=ollama,
        model_available=model_available,
        checked_at=time.strftime("%Y-%m-%dT%H:%M:%S"),
    )


@app.get("/api/speakers", response_model=list[SpeakerStyle])
async def speakers() -> list[SpeakerStyle]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(f"{VOICEVOX_BASE_URL}/speakers")
        response.raise_for_status()
        speaker_payload = response.json()

    styles: list[SpeakerStyle] = []
    for speaker in speaker_payload:
        speaker_name = speaker.get("name", "Unknown")
        speaker_uuid = speaker.get("speaker_uuid", "")
        for style in speaker.get("styles", []):
            styles.append(
                SpeakerStyle(
                    speaker_uuid=speaker_uuid,
                    speaker_name=speaker_name,
                    style_name=style.get("name", "Default"),
                    style_id=style.get("id", DEFAULT_SPEAKER),
                )
            )
    return styles


@app.post("/api/chain", response_model=ChainResponse)
async def chain(request: ChainRequest) -> ChainResponse:
    request_id = uuid.uuid4().hex[:8]
    started = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            question_started = time.perf_counter()
            question_audio = await voicevox_synthesize(
                client, request.text, request.question_speaker
            )
            question_elapsed = int((time.perf_counter() - question_started) * 1000)

            gemma_started = time.perf_counter()
            answer_text = await gemma_answer(
                client, question_audio, request.model, request.temperature
            )
            gemma_elapsed = int((time.perf_counter() - gemma_started) * 1000)

            answer_started = time.perf_counter()
            answer_audio = await voicevox_synthesize(
                client, answer_text, request.answer_speaker
            )
            answer_elapsed = int((time.perf_counter() - answer_started) * 1000)
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text or str(exc)
        raise HTTPException(status_code=502, detail=detail) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    total_elapsed = int((time.perf_counter() - started) * 1000)
    return ChainResponse(
        request_id=request_id,
        question_text=request.text,
        answer_text=answer_text,
        model=request.model,
        question_audio_data_url=audio_data_url(question_audio),
        answer_audio_data_url=audio_data_url(answer_audio),
        timings={
            "question_synthesis_ms": question_elapsed,
            "gemma_ms": gemma_elapsed,
            "answer_synthesis_ms": answer_elapsed,
            "total_ms": total_elapsed,
        },
    )


@app.get("/")
async def root() -> dict[str, Any]:
    return {"message": "Gemma Voice Loop backend is running."}
