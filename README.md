# gemma4-audio-ollama-demo

Minimal PowerShell demo for generating a WAV question with VOICEVOX and sending that audio to `gemma4:e2b` through the Ollama generate API.

## What it does

1. `generate_voicevox_question.ps1` calls a local VOICEVOX engine and writes:
   - `artifacts/question.wav`
   - `artifacts/question_query.json`
2. `send_wav_to_ollama_gemma4.ps1` base64-encodes the WAV file and sends it to Ollama with either:
   - `-Task transcribe`
   - `-Task answer`

The script stores response JSON and plain-text output under `artifacts/`.

## Requirements

- Windows PowerShell 5.1+ or PowerShell 7+
- A running VOICEVOX engine at `http://127.0.0.1:50021`
- A running Ollama server at `http://127.0.0.1:11434`
- The `gemma4:e2b` model pulled locally

```powershell
ollama pull gemma4:e2b
```

## Quick start

Generate a spoken question:

```powershell
.\generate_voicevox_question.ps1
```

Transcribe the generated audio:

```powershell
.\send_wav_to_ollama_gemma4.ps1 -Task transcribe
```

Answer the spoken question:

```powershell
.\send_wav_to_ollama_gemma4.ps1 -Task answer
```

## Output files

Running the scripts creates these files under `artifacts/`:

- `question.wav`
- `question_query.json`
- `gemma4_e2b_audio_transcript_response.json`
- `gemma4_e2b_audio_transcript.txt`
- `gemma4_e2b_audio_answer_response.json`
- `gemma4_e2b_audio_answer.txt`

## Notes

- The default output paths are relative to the script directory, so the repo is portable across machines.
- Ollama's `/api/generate` payload uses the `images` field for multimodal binary inputs; this demo places the base64-encoded WAV bytes there.
- Generated files are ignored by Git.
- Exact transcript and answer text can vary with the synthesized voice and current model behavior.

## License

MIT
