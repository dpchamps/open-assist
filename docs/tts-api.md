---
Qwen3 TTS API

Base URL: http://local.devbox.imgplex.io:8000

Overview

Text-to-Speech API with streaming support and voice cloning. Converts text to speech using Qwen3-TTS with 9 preset voices across 11 languages, plus support for custom cloned voices.

---
Endpoints

GET /health

Health check.

Response:
{
"status": "ok",
"custom_voice_model_loaded": true,
"base_model_loaded": true,
"voice_cloning_enabled": true
}

---
GET /info

Get available voices, languages, and cloning status.

Response:
{
"model_type": "dual",
"supported_languages": ["auto", "chinese", "english", "french", "german", "italian", "japanese", "korean", "portuguese", "russian", "spanish"],
"supported_voices": ["aiden", "dylan", "eric", "ono_anna", "ryan", "serena", "sohee", "uncle_fu", "vivian"],
"voice_cloning_enabled": true,
"cloned_voices": ["clone_abc123", "clone_def456"]
}

---
GET /voices

List all available voices (preset + cloned).

Response:
{
"voices": [
{"voice_id": "vivian", "name": "vivian", "type": "preset", "mode": null},
{"voice_id": "ryan", "name": "ryan", "type": "preset", "mode": null},
{"voice_id": "clone_abc123", "name": "my-voice", "type": "cloned", "mode": "icl"}
]
}

---
POST /voices/clone

Create a cloned voice from reference audio.

Request (JSON body):
{
"name": "my-voice",
"ref_audio_base64": "<base64 encoded WAV/MP3>",
"ref_text": "Transcript of the reference audio",
"mode": "icl"
}
┌──────────────────┬────────┬──────────┬─────────────────────────────────────────┐
│      Field       │  Type  │ Default  │              Description                │
├──────────────────┼────────┼──────────┼─────────────────────────────────────────┤
│ name             │ string │ required │ Human-readable name for the voice       │
├──────────────────┼────────┼──────────┼─────────────────────────────────────────┤
│ ref_audio_base64 │ string │ required │ Base64-encoded reference audio          │
├──────────────────┼────────┼──────────┼─────────────────────────────────────────┤
│ ref_text         │ string │ null     │ Transcript (required for ICL mode)      │
├──────────────────┼────────┼──────────┼─────────────────────────────────────────┤
│ mode             │ string │ "icl"    │ "icl" (higher quality) or "xvector"     │
└──────────────────┴────────┴──────────┴─────────────────────────────────────────┘

Modes:
- icl: In-Context Learning. Higher quality, requires ref_text transcript.
- xvector: X-vector embedding only. Faster, no transcript needed.

Response:
{
"voice_id": "clone_abc123",
"name": "my-voice",
"mode": "icl",
"created_at": "2026-02-07T21:00:00Z"
}

Example:
# Encode audio and clone voice
audio_b64=$(base64 -w0 reference.wav)
curl -X POST http://localhost:8000/voices/clone \
-H "Content-Type: application/json" \
-d "{\"name\": \"my-voice\", \"ref_audio_base64\": \"$audio_b64\", \"ref_text\": \"Hello, this is my voice sample.\"}"

---
DELETE /voices/{voice_id}

Delete a cloned voice. Returns 400 for preset voices.

Response:
{"success": true, "voice_id": "clone_abc123"}

Example:
curl -X DELETE http://localhost:8000/voices/clone_abc123

---
POST /tts/raw

Generate speech, return WAV file.

Request (JSON body):
{
"text": "Hello world",
"voice": "Vivian",
"language": "Auto",
"instruct": "say it happily"
}
┌────────────────┬────────┬──────────┬──────────────────────────────────────┐
│     Field      │  Type  │ Default  │            Description               │
├────────────────┼────────┼──────────┼──────────────────────────────────────┤
│ text           │ string │ required │ Text to synthesize                   │
├────────────────┼────────┼──────────┼──────────────────────────────────────┤
│ voice          │ string │ "Vivian" │ Voice name or cloned voice ID        │
├────────────────┼────────┼──────────┼──────────────────────────────────────┤
│ language       │ string │ "Auto"   │ Language code                        │
├────────────────┼────────┼──────────┼──────────────────────────────────────┤
│ instruct       │ string │ null     │ Tone/style instruction (preset only) │
├────────────────┼────────┼──────────┼──────────────────────────────────────┤
│ max_new_tokens │ int    │ null     │ Max generation tokens                │
├────────────────┼────────┼──────────┼──────────────────────────────────────┤
│ temperature    │ float  │ null     │ Sampling temperature                 │
├────────────────┼────────┼──────────┼──────────────────────────────────────┤
│ top_p          │ float  │ null     │ Top-p sampling                       │
├────────────────┼────────┼──────────┼──────────────────────────────────────┤
│ top_k          │ int    │ null     │ Top-k sampling                       │
└────────────────┴────────┴──────────┴──────────────────────────────────────┘
Response: audio/wav binary stream

Example (preset voice):
curl -X POST http://localhost:8000/tts/raw \
-H "Content-Type: application/json" \
-d '{"text": "Hello world", "voice": "Vivian"}' \
-o speech.wav

Example (cloned voice):
curl -X POST http://localhost:8000/tts/raw \
-H "Content-Type: application/json" \
-d '{"text": "Hello world", "voice": "clone_abc123"}' \
-o speech.wav

---
POST /tts

Generate speech, return base64-encoded WAV.

Request: Same as /tts/raw

Response:
{
"audio_base64": "UklGRv4BAABXQVZFZm10...",
"sample_rate": 24000,
"duration_seconds": 2.5
}

---
POST /tts/stream

Generate speech, stream audio chunks via SSE.

Request: Same as /tts/raw, plus:
┌───────────────┬──────┬─────────┬────────────────────────┐
│     Field     │ Type │ Default │      Description       │
├───────────────┼──────┼─────────┼────────────────────────┤
│ chunk_size_ms │ int  │ 100     │ Audio chunk size in ms │
└───────────────┴──────┴─────────┴────────────────────────┘
Response: Server-Sent Events stream

Events:
event: metadata
data: {"sample_rate": 24000, "channels": 1, "bits_per_sample": 16, "total_samples": 58965, "duration_seconds": 2.45}

event: chunk
data: {"index": 0, "audio_base64": "/P/4//7/CAAT...", "samples": 2400, "offset": 0}

event: chunk
data: {"index": 1, "audio_base64": "AQABAAIAAQAC...", "samples": 2400, "offset": 2400}

event: done
data: {"total_chunks": 25, "total_samples": 58965}

Example:
curl -N -X POST http://localhost:8000/tts/stream \
-H "Content-Type: application/json" \
-d '{"text": "Hello world", "voice": "Vivian"}'

---
POST /tts/stream-in

Stream text in, stream audio out.

Accepts streaming text input and returns streaming WAV audio. Text is buffered until sentence boundaries, then synthesized incrementally.

Query Parameters:
┌──────────┬────────┬──────────┬──────────────────────────────────────┐
│  Param   │  Type  │ Default  │            Description               │
├──────────┼────────┼──────────┼──────────────────────────────────────┤
│ voice    │ string │ "Vivian" │ Voice name or cloned voice ID        │
├──────────┼────────┼──────────┼──────────────────────────────────────┤
│ language │ string │ "Auto"   │ Language code                        │
├──────────┼────────┼──────────┼──────────────────────────────────────┤
│ instruct │ string │ null     │ Tone/style instruction (preset only) │
└──────────┴────────┴──────────┴──────────────────────────────────────┘
Request: Raw text body (supports chunked transfer encoding)

Response: audio/wav streaming binary

Examples:

# Simple pipe
echo "Hello world. How are you?" \
| curl -X POST "http://localhost:8000/tts/stream-in?voice=Vivian" \
--data-binary @- -o speech.wav

# Pipe from LLM or other streaming source
cat streamed_text.txt \
| curl -X POST "http://localhost:8000/tts/stream-in?voice=Ryan" \
--data-binary @- -o speech.wav

# With cloned voice
echo "Hello world." \
| curl -X POST "http://localhost:8000/tts/stream-in?voice=clone_abc123" \
--data-binary @- -o speech.wav

---
Preset Voices
┌──────────┬───────────────────────────┬───────────────────┐
│  Voice   │        Description        │  Native Language  │
├──────────┼───────────────────────────┼───────────────────┤
│ vivian   │ Bright, edgy young female │ Chinese           │
├──────────┼───────────────────────────┼───────────────────┤
│ serena   │ Warm, gentle young female │ Chinese           │
├──────────┼───────────────────────────┼───────────────────┤
│ uncle_fu │ Seasoned, low mellow male │ Chinese           │
├──────────┼───────────────────────────┼───────────────────┤
│ dylan    │ Clear natural timbre      │ Chinese (Beijing) │
├──────────┼───────────────────────────┼───────────────────┤
│ eric     │ Husky brightness          │ Chinese (Sichuan) │
├──────────┼───────────────────────────┼───────────────────┤
│ ryan     │ Dynamic male              │ English           │
├──────────┼───────────────────────────┼───────────────────┤
│ aiden    │ Sunny American male       │ English           │
├──────────┼───────────────────────────┼───────────────────┤
│ ono_anna │ Playful female            │ Japanese          │
├──────────┼───────────────────────────┼───────────────────┤
│ sohee    │ Warm emotional female     │ Korean            │
└──────────┴───────────────────────────┴───────────────────┘

---
Voice Cloning

Clone any voice from a reference audio sample:

1. Prepare a clear audio sample (3-10 seconds recommended)
2. For ICL mode, transcribe what is said in the audio
3. POST to /voices/clone with the audio and transcript
4. Use the returned voice_id in any TTS endpoint

Best practices:
- Use clean audio without background noise
- 5-10 seconds of speech is ideal
- ICL mode produces higher quality but requires accurate transcript
- Cloned voices are persisted and survive server restarts

---
Audio Format

- Sample Rate: 24000 Hz
- Channels: 1 (mono)
- Bit Depth: 16-bit PCM
- Format: WAV

---
Error Responses

{"detail": "Model not loaded"}                              // 503
{"detail": "Unknown voice: xyz. Available voices: [...]"}   // 400
{"detail": "Voice cloning not available..."}                // 400
{"detail": "Cannot delete preset voice: vivian"}            // 400
{"detail": "Voice not found: clone_xyz"}                    // 404
{"detail": "error message"}                                 // 500
{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}   // 422 validation