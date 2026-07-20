# Production Deployment Guide — Vaani AI

This guide details how to deploy all three core components of **Vaani AI**:
1. **Frontend**: Next.js 15 Web Application (`client/`)
2. **Backend**: FastAPI REST API (`server/`) containing speech-to-text (**faster-whisper**) and phoneme scoring (**Wav2Vec2**)
3. **AI Model (LLM)**: Conversational & grammar coaching intelligence (**Groq**, **Hugging Face**, **OpenAI**, or self-hosted **Ollama**)

---

## Deployment Architectures

Choose the strategy that best matches your hosting preferences:

| Deployment Method | Recommended For | Cost | Effort |
|---|---|---|---|
| **Option 1: Cloud Deployment**<br>*(Vercel + Render / HF Spaces + Groq)* | Production apps, zero hardware management | **$0 to $7/mo** | Low |
| **Option 2: Docker Compose (VPS)**<br>*(Self-hosted Linux Server / AWS EC2)* | Complete data ownership, full control | **$10–$20/mo** | Medium |

---

## Option 1: Managed Cloud Deployment (Recommended)

### Step 1: Deploy Backend & Speech Models to Render or Hugging Face Spaces

#### Deployment Option A: Render (Web Service)
1. Fork or push your code repository to GitHub / GitLab.
2. Sign in to [Render](https://render.com) and click **New +** > **Web Service**.
3. Connect your GitHub repository.
4. Select **Docker** as the Environment.
5. Set the build parameters:
   - **Docker Command / Path**: `./Dockerfile`
   - **Instance Type**: Starter ($7/mo) or standard tier (Minimum 2 GB RAM recommended for Whisper model).
6. Add Environment Variables under **Environment**:
   - `JWT_SECRET`: Generate a secure random string (e.g. `python -c "import secrets; print(secrets.token_hex(32))"`)
   - `GROQ_API_KEY`: *(Recommended for free, instant LLM)* your API key from [console.groq.com](https://console.groq.com)
   - Or `HF_TOKEN`: Hugging Face API Token
7. Click **Create Web Service**. Copy your public backend URL (e.g., `https://vaani-backend.onrender.com`).

#### Deployment Option B: Hugging Face Spaces (Free 16 GB RAM Tier)
1. Go to [Hugging Face Spaces](https://huggingface.co/spaces) and click **Create new Space**.
2. Set Space SDK to **Docker** (Blank).
3. Clone the space repo locally or push your code to it:
   ```bash
   git remote add hf https://huggingface.co/spaces/YOUR_USERNAME/vaani-backend
   git push hf main
   ```
4. In Space Settings, set Secret environment variables:
   - `PORT`: `7860`
   - `JWT_SECRET`: `<your-jwt-secret>`
   - `GROQ_API_KEY` or `HF_TOKEN`: `<your-llm-api-key>`
5. Your API will be live at `https://YOUR_USERNAME-vaani-backend.hf.space`.

---

### Step 2: Deploy Frontend to Vercel

1. Log in to [Vercel](https://vercel.com) and click **Add New** > **Project**.
2. Import your GitHub repository.
3. Set **Root Directory** to `client`.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_API_BASE_URL`: `https://vaani-backend.onrender.com` (or your HF Space URL)
   - `NEXT_PUBLIC_DEMO_MODE`: `false`
5. Click **Deploy**. Vercel will build the Next.js app and assign a domain (e.g. `https://vaani-ai.vercel.app`).

---

## Option 2: Self-Hosted Deployment via Docker Compose

If you have a Linux VPS (Ubuntu 22.04 / Debian / AWS EC2 / DigitalOcean Droplet):

### 1. Prerequisites
- Docker & Docker Compose installed:
  ```bash
  sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
  ```

### 2. Environment Setup
Create a `.env` file in the project root directory:

```bash
# Production Secret
JWT_SECRET=c3a9f0e1d8b7a6543210fe9876543210c3a9f0e1d8b7a6543210fe9876543210

# Public API URL for browser requests
NEXT_PUBLIC_API_BASE_URL=http://YOUR_SERVER_IP:4000

# Cloud LLM Key (or leave empty if running local Ollama container)
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### 3. Launch the Production Stack
Run:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Check running containers:
```bash
docker compose -f docker-compose.prod.yml ps
```

Your services will be active at:
- **Frontend**: `http://YOUR_SERVER_IP:3000`
- **Backend API**: `http://YOUR_SERVER_IP:4000`

---

## Environment Variables Reference

| Variable | Scope | Description | Default |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Public backend URL accessible from browser | `http://localhost:4000` |
| `NEXT_PUBLIC_DEMO_MODE` | Frontend | `false` to enable live backend calls; `true` for mock data | `false` |
| `PORT` | Backend | HTTP port FastAPI listens on | `4000` |
| `JWT_SECRET` | Backend | HS256 secret key for authentication tokens | Required in Prod |
| `GROQ_API_KEY` | Backend | Groq LLM API key (Free ultra-fast Llama-3 / Mistral) | Optional |
| `HF_TOKEN` | Backend | Hugging Face Inference API token | Optional |
| `OPENAI_API_KEY` | Backend | OpenAI API key for GPT-4o-mini | Optional |
| `GEMINI_API_KEY` | Backend | Google Gemini Flash API key | Optional |
| `OLLAMA_URL` | Backend | Ollama endpoint URL | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | Backend | Ollama model name | `mistral` |

---

## Verification & Health Check

1. **Backend Health Check**:
   ```bash
   curl https://your-backend-url/api/health
   # Expected response: {"status": "ok", "message": "Vani AI backend is running."}
   ```

2. **Frontend Connection Check**:
   Open your frontend URL in the browser, log in or register a new user, and initiate a speech session to verify real-time transcription and grammar evaluation.
