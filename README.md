# PaperVideo

AI platform that converts research papers (PDFs) into narrated, animated video presentations. Drop a PDF, get a professional video walkthrough in minutes.

**Live:** [banim.vercel.app](https://banim.vercel.app)

---

## How It Works

```
PDF  ──>  Extract  ──>  Plan  ──>  Render  ──>  Narrate  ──>  Assemble  ──>  MP4
          Reducto       GPT-4o     Remotion      Azure TTS     FFmpeg
          PyMuPDF                  Playwright
```

1. **Extract** — Parse the PDF into structured content: title, authors, abstract, sections, figures, tables. Uses [Reducto](https://reducto.ai) for document understanding and PyMuPDF for figure extraction.

2. **Plan** — GPT-4o reads the extracted content and plans a sequence of scenes. For each scene it picks one of 20 animation templates and writes narration text (2-4 sentences per scene).

3. **Render** — Each scene is rendered to video frames. Two renderers available:
   - **Remotion** (default) — React components with paper-texture aesthetics, rough.js hand-drawn borders, staggered animations. Renders each scene as a standalone MP4 at 1920x1080 / 30fps.
   - **Playwright** — HTML templates rendered via headless Chromium. Lighter weight, fewer visual effects.

4. **Narrate** — Azure Cognitive Services synthesizes narration audio (MP3) for each scene in parallel. Voice: `en-US-AndrewMultilingualNeural`.

5. **Assemble** — FFmpeg combines each scene's video + audio into clips, then concatenates all clips into the final MP4. Generates `chapters.json` with accurate seek timestamps.

---

## Templates

20 animation templates organized into two categories:

### Layout
| Template | Description |
|----------|-------------|
| `title_card` | Opening slide — title, authors, venue badge |
| `section_header` | Section transition — Roman numeral, heading, tagline |
| `flashcard_list` | Numbered cards that appear one-by-one, active item highlighted |
| `bullet_list` | Bullet points with staggered reveal (alias for flashcard_list) |
| `big_number` | Hero metric with decorative rings |
| `comparison_split` | Side-by-side A vs B with positive/negative/neutral tone |
| `quote_highlight` | Large quote with phrase highlighting |
| `data_table` | Tabular results with header styling |
| `image_with_caption` | Extracted paper figure with caption |
| `closing_card` | Summary slide with gradient accents |
| `multi_metric_cards` | 3-4 metric cards with delta indicators |

### Charts
| Template | Description |
|----------|-------------|
| `bar_chart` | Vertical bars with highlight index |
| `grouped_bar_chart` | Multi-series side-by-side bars |
| `horizontal_bar_chart` | Horizontal bars, auto-sorted |
| `line_chart` | Multi-series smooth line graph |
| `scatter_plot` | Grouped scatter points with labels |
| `pie_donut_chart` | Donut chart with center label |
| `heatmap` | Color-coded matrix visualization |

All Remotion templates share a consistent visual language: parchment paper texture, Playfair Display serif headings, Inter sans-serif body text, rough.js hand-drawn borders, and smooth entrance animations.

---

## Project Structure

```
app.py                    # FastAPI server — upload, status, stream, chapters
pipeline.py               # Job orchestrator — chains all stages
stage1_extract.py         # PDF extraction (Reducto + PyMuPDF)
stage2_planner.py         # LLM scene planning (Azure OpenAI GPT-4o)
stage4_render.py          # HTML/Playwright frame renderer
stage4_render_remotion.py # Remotion React video renderer
stage5_tts.py             # Azure TTS with retry + exponential backoff
stage6_assembly.py        # FFmpeg assembly + chapters.json generation
template_engine.py        # HTML data injection for Playwright templates
template_registry.py      # Template metadata registry (20 templates)
config.py                 # keys.json → env var fallback

prompts/
  planner_system.txt      # GPT-4o system prompt with template catalog

templates/
  scenes/                 # HTML templates for Playwright renderer
  theme.css               # Shared Tailwind CSS theme

remotion-presets/         # Remotion React compositions
  src/
    Root.tsx              # Composition registry
    presets/              # One TSX file per template (TitleCard, FlashcardList, etc.)

platform/                 # React frontend (Vite + TypeScript + Tailwind)
  src/app/
    pages/                # Home, Processing, Viewer, Library
    components/           # Radix UI primitives
    lib/                  # API client, data helpers

scripts/
  deploy.sh              # Build + deploy to Azure Container Apps
  shell.sh               # Shell into running container
  logs.sh                # Stream container logs

tests/                   # pytest backend tests
output/                  # Generated video outputs (gitignored)
uploaded-pdfs/           # Deduplicated uploads (gitignored)
```

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload PDF, returns `{job_id}` |
| `GET` | `/status/{job_id}` | Job progress — status, scenes_done/total, error |
| `GET` | `/job/{job_id}/data` | Extraction + plan JSON |
| `GET` | `/stream/{job_id}` | Stream final MP4 for browser playback |
| `GET` | `/download/{job_id}` | Download final MP4 |
| `GET` | `/chapters/{job_id}` | Scene timestamps for seek bar |
| `GET` | `/api/templates` | List templates by category |
| `POST` | `/api/template-preview/{name}` | Render template with custom data |

**Status values:** `queued` → `extracting` → `planning` → `rendering` → `synthesizing_tts` → `assembling` → `done` / `failed`

---

## Setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- FFmpeg
- Azure account (OpenAI, Cognitive Services, optionally Blob Storage)
- Reducto API key

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Create `keys.json` in the project root:

```json
{
  "reducto_api_key": "...",
  "azure_openai_endpoint": "https://YOUR_RESOURCE.openai.azure.com/",
  "azure_openai_api_key": "...",
  "azure_openai_planner_deployment": "gpt-4o",
  "azure_openai_htmlgen_deployment": "gpt-4o",
  "azure_tts_key": "...",
  "azure_tts_region": "eastus"
}

```

Start the server:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

### Remotion Templates (optional)

```bash
cd remotion-presets
npm install
```

Enable Remotion rendering:

```bash
RENDER_MODE=remotion uvicorn app:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd platform
npm install
npm run dev    # http://localhost:5173, proxies API to localhost:8000
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `RENDER_MODE` | `html` | `html` (Playwright) or `remotion` (React video) |
| `RENDER_CONCURRENCY` | `4` | Parallel scene renders |
| `ASSEMBLY_CONCURRENCY` | `4` | Parallel clip assembly |
| `AZURE_STORAGE_CONNECTION_STRING` | — | Enable blob upload after assembly |
| `AZURE_STORAGE_CONTAINER` | `videos` | Blob container name |
| `CORS_ORIGINS` | localhost + vercel | Comma-separated allowed origins |

Config reads `keys.json` first, falls back to uppercase env vars (e.g., `REDUCTO_API_KEY`).

---

## Testing

```bash
# Backend
python -m pytest tests/ -v

# Frontend
cd platform && npm test
```

Pre-push hook runs both automatically.

---

## Deployment

### Azure Container Apps (Backend)

```bash
./scripts/deploy.sh    # Builds image in ACR + deploys to Container Apps
```

Or manually:

```bash
az acr build --registry banimcr --image banim-api:latest --file Dockerfile .
az containerapp update --name banim-api --resource-group banim-rg \
  --image banimcr.azurecr.io/banim-api:latest
```

Admin:

```bash
./scripts/shell.sh     # Shell into running container
./scripts/logs.sh      # Stream container logs
```

### Vercel (Frontend)

Auto-deploys from `main` branch push. The frontend is a static SPA — sample video thumbnails load from Azure Blob Storage, no backend needed for the showcase.

### Azure VM (Heavy Rendering)

For Remotion rendering which needs more memory than Container Apps' 8GB limit:

```bash
az vm start --name mars2 --resource-group MARTIAN_WEST
ssh mars_rover@<VM_IP>
cd banim && source .venv/bin/activate
RENDER_MODE=remotion RENDER_CONCURRENCY=8 python -c "
from pipeline import create_job, run_pipeline
job_id = create_job(Path('paper.pdf'))
run_pipeline(job_id)
"
az vm deallocate --name mars2 --resource-group MARTIAN_WEST  # Stop billing
```

### CI/CD

GitHub Actions (`.github/workflows/deploy.yml`):
- Triggers on push to `main`
- Runs pytest + vitest
- Builds Docker image in Azure Container Registry
- Deploys to Container Apps

---

## Architecture Decisions

**No database.** Jobs are tracked in-memory during execution and reconstructed from disk (`extraction.json`, `plan.json`, `final.mp4`) if the server restarts. Frontend state lives in localStorage.

**Two renderers.** Playwright (HTML) is lightweight and works anywhere. Remotion (React) produces richer visuals but needs Node.js + more memory. The pipeline auto-falls back to HTML for templates without Remotion compositions.

**Parallel everywhere.** Rendering, TTS, and assembly all use thread pools. TTS pre-warms during rendering to hide initialization latency.

**Defensive prop coercion.** LLM output is unpredictable — `adapt_props()` normalizes every template's data (empty strings → arrays, string numbers → ints, missing fields → defaults) before passing to Remotion.

**Explicit FFmpeg stream mapping.** Remotion MP4s include a silent audio track. Assembly uses `-map 0:v:0 -map 1:a:0` to always pick TTS audio over Remotion's built-in silence.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, Uvicorn |
| PDF Parsing | Reducto API, PyMuPDF |
| LLM | Azure OpenAI (GPT-4o) |
| TTS | Azure Cognitive Services |
| Rendering | Remotion 4.0 (React) / Playwright (Chromium) |
| Video | FFmpeg (H.264, AAC) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 4, Radix UI |
| Infrastructure | Azure Container Apps, Azure Blob Storage, Vercel |
