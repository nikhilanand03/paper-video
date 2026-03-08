"""FastAPI app — upload PDF, track progress, download result."""

from __future__ import annotations

import json
import os
import shutil
import threading
from pathlib import Path

from fastapi import FastAPI, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pipeline import create_job, get_job, run_pipeline, OUTPUT_ROOT, UPLOADED_PDFS_DIR
from template_registry import REGISTRY, TemplateMeta
from template_engine import prepare_scene_html_web, TEMPLATES_DIR

app = FastAPI(title="Paper-to-Video")

_default_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://banim.vercel.app",
]
_cors_origins = os.environ.get("CORS_ORIGINS", "").split(",") if os.environ.get("CORS_ORIGINS") else _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/upload")
async def upload_pdf(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file.")

    # Save uploaded PDF to a temp location outside uploaded-pdfs,
    # so create_job will run _store_pdf to deduplicate it properly.
    tmp_path = OUTPUT_ROOT / f"_tmp_{file.filename}"
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    job_id = create_job(tmp_path)
    tmp_path.unlink(missing_ok=True)

    # Run pipeline in background thread
    t = threading.Thread(target=run_pipeline, args=(job_id,), daemon=True)
    t.start()

    return {"job_id": job_id}


@app.get("/status/{job_id}")
async def job_status(job_id: str):
    job = get_job(job_id)

    # If not in memory, try to reconstruct from disk (server may have restarted)
    if not job:
        job_dir = OUTPUT_ROOT / job_id
        if job_dir.is_dir():
            final = job_dir / "final.mp4"
            plan_file = job_dir / "planned_outputs" / "full_plan.json"
            scenes_total = 0
            if plan_file.exists():
                plan_data = json.loads(plan_file.read_text())
                scenes_total = len(plan_data.get("scenes", []))
            return {
                "status": "done" if final.exists() else "failed",
                "error": None,
                "scenes_total": scenes_total,
                "scenes_done": scenes_total if final.exists() else 0,
            }
        raise HTTPException(404, "Job not found.")

    return {
        "status": job["status"],
        "error": job["error"],
        "scenes_total": job["scenes_total"],
        "scenes_done": job["scenes_done"],
    }


@app.get("/job/{job_id}/data")
async def job_data(job_id: str):
    """Return extraction + plan data for the frontend viewer."""
    job = get_job(job_id)
    job_dir = OUTPUT_ROOT / job_id
    if not job and not job_dir.is_dir():
        raise HTTPException(404, "Job not found.")
    if job:
        job_dir = Path(job["job_dir"])
    result: dict = {}

    # ── Paper metadata ──
    # Try in-memory first, then extraction.json, then text.json (legacy)
    paper = job.get("paper") if job else None
    if not paper:
        ext_path = job_dir / "extraction.json"
        if ext_path.exists():
            paper = json.loads(ext_path.read_text())
    if not paper:
        text_path = job_dir / "text.json"
        if text_path.exists():
            paper = json.loads(text_path.read_text())
    if paper:
        result["paper"] = paper

    # ── Scene plan ──
    # Try in-memory first, then plan.json, then planned_outputs/full_plan.json (legacy)
    plan = job.get("plan") if job else None
    if not plan:
        plan_path = job_dir / "plan.json"
        if plan_path.exists():
            plan = json.loads(plan_path.read_text())
    if not plan:
        full_plan_path = job_dir / "planned_outputs" / "full_plan.json"
        if full_plan_path.exists():
            plan = json.loads(full_plan_path.read_text())
    if plan:
        result["plan"] = plan

    return result


def _find_video(job_id: str) -> Path:
    """Find the final video file for a job (in-memory or on disk)."""
    job = get_job(job_id)
    if job and job.get("final_path"):
        p = Path(job["final_path"])
        if p.exists():
            return p
    # Fallback: look on disk
    job_dir = OUTPUT_ROOT / job_id
    final = job_dir / "final.mp4"
    if final.exists():
        return final
    raise HTTPException(404, "Video not found.")


@app.get("/stream/{job_id}")
async def stream_video(job_id: str):
    """Serve the video for in-browser playback."""
    return FileResponse(_find_video(job_id), media_type="video/mp4")


@app.get("/download/{job_id}")
async def download_video(job_id: str):
    """Serve the video as a download."""
    final = _find_video(job_id)
    return FileResponse(final, media_type="video/mp4", filename=f"{job_id}.mp4")


# ── Playground API ────────────────────────────────────────────────────────────


@app.get("/api/templates")
async def list_templates():
    """Return template names grouped by category."""
    layout = []
    charts = []
    chart_names = {
        "bar_chart", "line_chart", "donut_chart",
    }
    for name, meta in REGISTRY.items():
        (charts if name in chart_names else layout).append(name)
    return {"layout": layout, "charts": charts}


@app.post("/api/template-preview/{name}")
async def template_preview(name: str, request: Request):
    """Render a template with the provided JSON data for browser preview."""
    if name not in REGISTRY:
        raise HTTPException(404, f"Unknown template: {name}")
    data = await request.json()
    html = prepare_scene_html_web(REGISTRY[name], data)
    return {"html": html}


@app.get("/api/theme.css")
async def serve_theme_css():
    """Serve theme.css for iframe previews."""
    css_path = TEMPLATES_DIR / "theme.css"
    if not css_path.exists():
        raise HTTPException(404, "theme.css not found")
    return FileResponse(css_path, media_type="text/css")


# Serve frontend
app.mount("/", StaticFiles(directory="static", html=True), name="static")
