# PaperVideo (Banim)

AI platform that converts research papers (PDFs) into animated video presentations.

## Stack

- **Backend:** Python 3.12, FastAPI, Playwright, ffmpeg
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS 4, Radix UI
- **Cloud:** Azure (OpenAI, TTS, Blob Storage, Container Apps), Reducto API, Vercel

## Project Structure

```
app.py                  # FastAPI server (entry point)
run_cli.py              # CLI runner for local video generation
pipeline/
  __init__.py           # Re-exports (backward compat)
  orchestrator.py       # JobManager + Pipeline classes
  config.py             # Pydantic BaseSettings (keys.json → env vars)
  extract.py            # PDF extraction (Reducto + PyMuPDF)
  planner.py            # LLM scene planning (Azure OpenAI GPT-4o)
  render.py             # HTML/Playwright renderer + Renderer protocol
  render_remotion.py    # Remotion React renderer (fallback to HTML)
  tts.py                # Azure TTS with retry
  assembly.py           # ffmpeg assembly + chapters.json
  template_registry.py  # 20 animation template metadata
  template_engine.py    # HTML data injection
templates/scenes/       # HTML templates for Playwright
prompts/                # LLM system prompts
remotion-presets/       # React/Remotion compositions
platform/               # React frontend
  src/app/
    pages/              # Home, Processing, Viewer, Library
    lib/                # api.ts, samples.ts, storage.ts, templates.ts, useVideoPlayer.ts
    components/         # Radix UI primitives
tests/                  # pytest backend tests
scripts/                # deploy.sh, shell.sh, logs.sh
```

## Commands

```bash
# Backend
source .venv/bin/activate
uvicorn app:app --host 0.0.0.0 --port 8000
python -m pytest tests/ -v

# Frontend
cd platform && npm run dev    # proxies to localhost:8000
cd platform && npm run build
cd platform && npm test

# Deploy
./scripts/deploy.sh
```

## Key Patterns

- **Pipeline:** Extract → Plan → Render → TTS → Assemble (parallel where possible)
- **Config:** Pydantic BaseSettings reads `keys.json`, falls back to uppercase env vars
- **No database** — in-memory job state + filesystem + Azure Blob Storage
- **Pre-push hook** runs pytest + vitest
- **CORS:** localhost:5173, banim.vercel.app, holi-hack.vercel.app (or CORS_ORIGINS env)

## Don'ts

- Don't commit `keys.json`, `.env`, or anything in `output/`
- Don't modify templates without checking `pipeline/template_registry.py` mappings
