# Gemma Voice Loop Demo

Local demo app for this loop:

1. Text input
2. VOICEVOX generates question audio
3. Gemma 4 E2B listens to that WAV and answers
4. VOICEVOX reads the answer aloud

## Structure

- `backend/`: FastAPI app managed by `uv`
- `frontend/`: Vite + React + TypeScript + Tailwind + shadcn-style UI
- Existing PowerShell helper scripts remain in the repo root for direct local experiments

## Requirements

- VOICEVOX API running on `http://127.0.0.1:50021`
- Ollama running on `http://127.0.0.1:11434`
- `gemma4:e2b` pulled locally
- Node.js and `uv`

## Run

Backend:

```powershell
uv run --directory backend uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://127.0.0.1:5173`.

## API

- `GET /api/health`
- `GET /api/speakers`
- `POST /api/chain`

Example request body:

```json
{
  "text": "What is your favorite color?",
  "question_speaker": 2,
  "answer_speaker": 2
}
```

## Notes

- The frontend proxies `/api` to the backend during development.
- The backend currently sends the generated WAV to Gemma through Ollama `images` with base64 audio, matching the local experiment path that worked in this workspace.
- Audio is returned to the frontend as data URLs for a simple first version.
