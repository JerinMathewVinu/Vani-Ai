# ConviAI — AI English Communication Coach

A full-stack web app that helps users improve their spoken English: live transcription, grammar correction, vocabulary suggestions, and progress tracking. The backend uses **faster-whisper** for STT, a local **Ollama/Mistral** LLM for correction, and SQLite for persistence. The frontend is **Next.js 15 + React 19 + Tailwind** with a built-in mock-data fallback for offline development.

## Layout

```
.
├── client/          Next.js 15 + TypeScript frontend (port 3000)
├── server/          FastAPI backend (port 4000)
├── Dockerfile       Backend container (multi-stage, ~1 GB final image)
├── .dockerignore
└── README.md        ← you are here
```

The frontend expects the backend at `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`). The frontend's `next.config.mjs` also includes an `/api/*` rewrite as a single-origin fallback.

## Local development

### Backend

```bash
cd server
python -m venv .venv
.venv/Scripts/activate         # Windows
# source .venv/bin/activate    # macOS / Linux
pip install -r requirements.txt
python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 4000
```

Requirements: Python 3.10+ and `ffmpeg` on PATH (for faster-whisper audio decoding). Install ffmpeg via your package manager:

- Windows: download from https://ffmpeg.org/download.html and add to PATH
- macOS: `brew install ffmpeg`
- Debian / Ubuntu: `sudo apt-get install ffmpeg`
- Hugging Face Space: already installed in the Dockerfile

The first time `/api/speech/analyze` is called, faster-whisper downloads the `tiny.en` model (~75 MB) into `~/.cache/huggingface/`.

### Frontend

```bash
cd client
npm install
npm run dev
```

Open http://localhost:3000. The signup, login, dashboard, voice practice, and AI correction pages hit the real backend. The other pages (vocabulary, partner, interview, group, analytics, reports, profile, settings) use built-in mock data because `NEXT_PUBLIC_DEMO_MODE=true` in `client/.env.local`. To re-enable the real backend for those pages, set the flag to `false` and implement the corresponding endpoints on the server.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | no | Liveness check |
| POST | `/api/auth/register` | no | Create account, return `{user, token}` |
| POST | `/api/auth/login` | no | Email + password, return `{user, token}` |
| GET | `/api/auth/me` | yes | Current user from bearer token |
| POST | `/api/auth/forgot-password` | no | Stub: always returns `{message:"ok"}` |
| POST | `/api/auth/reset-password` | no | Stub: always returns `{message:"ok"}` |
| POST | `/api/auth/verify` | no | Stub: returns most recent user |
| POST | `/api/practice/start` | yes | Create session row, return `{sessionId}` |
| POST | `/api/practice/stop` | yes | Finalize most recent active session |
| POST | `/api/speech/analyze` | yes | Upload audio, get `PracticeResult` |
| POST | `/api/correction` | yes | Text in, 4-variant `CorrectionResult` out |
| GET | `/api/dashboard` | yes | Aggregated user stats |
| GET | `/api/dashboard/sessions?limit=N` | yes | Recent sessions list |
| POST | `/api/transcribe` | no (legacy) | STT only, no LLM |
| POST | `/api/assistant` | no (legacy) | Text-only correction |
| POST | `/api/session/audio` | no (legacy) | Full pipeline, legacy shape |

All `/api/auth/*`, `/api/practice/*`, `/api/speech/*`, `/api/correction`, and `/api/dashboard*` endpoints require `Authorization: Bearer <jwt>` unless noted. JWTs are HS256, 7-day TTL, secret from `JWT_SECRET` env var (defaults to an insecure dev secret — set it for production).

## LLM configuration

The backend talks to a local LLM via Ollama or any OpenAI-compatible endpoint. Set the env vars before starting:

```bash
# Ollama (default)
export OLLAMA_URL=http://127.0.0.1:11434
export OLLAMA_MODEL=mistral

# OR a generic OpenAI-compat endpoint
export LOCAL_MISTRAL_URL=http://localhost:8080/v1/chat/completions
export LOCAL_MISTRAL_MODEL=mistral-7b-instruct
```

If no LLM is reachable, the backend falls back to a regex-based filler-word stripper. The grammar-correction quality will be much lower, but the API will still respond.

The `OLLAMA_URL` parser supports three forms:
- `http://host:11434` → tries `/api/chat`, `/api/generate`, `/v1/chat/completions`
- `http://host:11434/v1` → tries `/v1/chat/completions` (OpenAI-compat)
- `http://host:11434/api/chat` → used verbatim

## Free public deployment

The cheapest realistic setup is **$0/month**:

| Component | Free host | Free tier |
|---|---|---|
| Frontend | **Cloudflare Pages** | Unlimited bandwidth, free SSL, free custom domain |
| Backend | **Hugging Face Spaces** (Docker SDK) | 16 GB RAM, 2 vCPU, persistent disk, never sleeps |
| LLM | **Hugging Face Inference API** (free tier) or local Mistral in the same Space | Depends on model size |

For HF Spaces, push the repo to a Space, point its Docker config at the root `Dockerfile`, and set the environment variables (`PORT=7860` since that's what HF Spaces expects — or use the auto-port mapping). Full walkthrough: see `DEPLOY.md` (TODO if you want one — for now the Dockerfile + this README are enough to ship).

If you'd rather pay for stability: **Render**'s $7/mo Starter plan or **Fly.io** at ~$5/mo for a 1 GB VM will both work, but for a real-time Whisper workload you want at least 2 GB of RAM.

## Limitations / what's not built

- Email delivery (the `/auth/forgot-password` and `/auth/verify` endpoints are stubs)
- Real grammar-error correction (we emit a placeholder when original ≠ corrected)
- Real WebSocket streaming for live captions (the frontend has `socket.io-client` wired but no server endpoint yet)
- TTS playback (the server used to generate SAPI5 audio and silently drop it; the entire TTS code path has been removed)
- Pronunciation scoring (we derive a heuristic from confidence; no pronunciation model)
- Real session-duration tracking (we fall back to a words-spoken estimate)
- Vocabulary, partner, interview, group, challenge, analytics, reports, profile, settings — the frontend pages exist but stay on mock data

These are tracked in `server/routes/` and `client/src/api/` — each missing endpoint has a corresponding `*.ts` file ready to be filled in.
