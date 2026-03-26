"""Pipeline orchestrator — chains all stages and tracks job status."""

from __future__ import annotations

import hashlib
import json
import re
import threading
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

import os

from stage1_extract import extract_pdf
from stage2_planner import plan_scenes
from stage4_render import render_scenes
from stage4_render_remotion import render_scenes_remotion
from stage5_tts import synthesize_all, warmup_tts
from stage6_assembly import assemble

# Render mode: "html" (Playwright) or "remotion" (React video)
RENDER_MODE = os.environ.get("RENDER_MODE", "html")

OUTPUT_ROOT = Path(__file__).parent / "output"
UPLOADED_PDFS_DIR = Path(__file__).parent / "uploaded-pdfs"


class Status(str, Enum):
    QUEUED = "queued"
    EXTRACTING = "extracting"
    PLANNING = "planning"
    RENDERING = "rendering"
    SYNTHESIZING_TTS = "synthesizing_tts"
    ASSEMBLING = "assembling"
    DONE = "done"
    FAILED = "failed"


# In-memory job store (sufficient for single-process uvicorn)
_jobs: dict[str, dict[str, Any]] = {}


def _sanitize(name: str, max_len: int = 12) -> str:
    """Turn a paper title into a short filesystem-safe slug."""
    name = name.lower().strip()
    # Take first word that's 4+ chars, or first two words
    words = re.findall(r"[a-z0-9]+", name)
    slug = words[0] if words else "untitled"
    if len(slug) < 4 and len(words) > 1:
        slug = words[0] + words[1]
    return slug[:max_len]


def _next_run_name(slug: str, suffix: str = "") -> str:
    """Find next available name like immuno1, immuno2, immuno3_fo."""
    existing = sorted(OUTPUT_ROOT.glob(f"{slug}*")) if OUTPUT_ROOT.exists() else []
    # Extract existing run numbers for this slug
    max_num = 0
    for p in existing:
        m = re.match(rf"^{re.escape(slug)}(\d+)", p.name)
        if m:
            max_num = max(max_num, int(m.group(1)))
    return f"{slug}{max_num + 1}{suffix}"


def _store_pdf(pdf_path: Path) -> Path:
    """Copy PDF to uploaded-pdfs/ (deduplicated by content hash). Return stored path."""
    UPLOADED_PDFS_DIR.mkdir(parents=True, exist_ok=True)
    content = pdf_path.read_bytes()
    file_hash = hashlib.sha256(content).hexdigest()[:16]
    stored = UPLOADED_PDFS_DIR / f"{file_hash}_{pdf_path.name}"
    if not stored.exists():
        stored.write_bytes(content)
    return stored


def create_job(pdf_path: Path, frames_only: bool = False, suffix: str = "") -> str:
    # Use PDF filename stem as a temporary slug; will be replaced with paper title later
    pdf_path = Path(pdf_path)
    tmp_slug = _sanitize(pdf_path.stem)
    if not suffix:
        suffix = "_fo" if frames_only else ""
    job_id = _next_run_name(tmp_slug, suffix)
    job_dir = OUTPUT_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # Store/deduplicate PDF unless it's already in uploaded-pdfs or sample-pdfs
    parent_name = pdf_path.parent.name
    if parent_name not in ("uploaded-pdfs", "sample-pdfs"):
        pdf_path = _store_pdf(pdf_path)

    # Write job metadata
    meta = {"pdf_path": str(pdf_path.resolve())}
    (job_dir / "job.json").write_text(json.dumps(meta, indent=2))

    _jobs[job_id] = {
        "status": Status.QUEUED,
        "pdf_path": str(pdf_path),
        "job_dir": str(job_dir),
        "error": None,
        "scenes_total": 0,
        "scenes_done": 0,
    }
    return job_id


def get_job(job_id: str) -> dict[str, Any] | None:
    return _jobs.get(job_id)


PIPELINE_STAGES_FULL = [
    Status.EXTRACTING,
    Status.PLANNING,
    Status.RENDERING,
    Status.SYNTHESIZING_TTS,
    Status.ASSEMBLING,
    Status.DONE,
]

PIPELINE_STAGES_FRAMES_ONLY = [
    Status.EXTRACTING,
    Status.PLANNING,
    Status.RENDERING,
    Status.DONE,
]

_STAGE_LABELS = {
    Status.EXTRACTING: "Extracting PDF",
    Status.PLANNING: "Planning scenes",
    Status.RENDERING: "Rendering frames",
    Status.SYNTHESIZING_TTS: "Synthesizing TTS",
    Status.ASSEMBLING: "Assembling video",
    Status.DONE: "Done",
}


def run_pipeline(
    job_id: str,
    on_stage: callable = None,
    frames_only: bool = False,
    till_stage: str | None = None,
) -> None:
    """Execute the pipeline, optionally stopping after a specific stage.

    Args:
        on_stage: Optional callback(status, label) called when each stage starts.
        frames_only: If True, stop after rendering frames (skip TTS and assembly).
        till_stage: Stop after this stage. One of "extract", "plan", "render", "tts".
                    Overrides frames_only when set.
    """
    job = _jobs[job_id]
    job_dir = Path(job["job_dir"])

    def _notify(status: Status) -> None:
        job["status"] = status
        if on_stage:
            on_stage(status, _STAGE_LABELS.get(status, status.value))

    try:
        # Stage 1 — Extract PDF
        _notify(Status.EXTRACTING)
        paper = extract_pdf(job["pdf_path"], output_dir=job_dir)

        # Always persist extraction data for the frontend
        (job_dir / "extraction.json").write_text(json.dumps(paper, indent=2, default=str))
        job["paper"] = paper

        if till_stage == "extract":
            _notify(Status.DONE)
            return

        # Stage 2 — Plan scenes (LLM picks templates + data)
        _notify(Status.PLANNING)
        plan = plan_scenes(paper, output_dir=job_dir)
        job["scenes_total"] = len(plan.scenes)

        # Always persist plan data for the frontend
        plan_dict = plan.model_dump()
        (job_dir / "plan.json").write_text(json.dumps(plan_dict, indent=2, default=str))
        job["plan"] = plan_dict

        if till_stage == "plan":
            _notify(Status.DONE)
            return

        # Stage 4 — Render templates to frames (Stage 3 eliminated)
        _notify(Status.RENDERING)

        # Pre-warm Azure TTS in background while rendering runs
        if not frames_only and till_stage not in ("render",):
            threading.Thread(target=warmup_tts, daemon=True).start()

        def _on_scene_done(n: int) -> None:
            job["scenes_done"] = n

        render_mode = os.environ.get("RENDER_MODE", RENDER_MODE)

        if frames_only or till_stage == "render":
            preview_dir = job_dir / "preview"
            render_results = render_scenes(
                plan.scenes, preview_dir, preview_only=True,
                on_scene_done=_on_scene_done,
            )
            _notify(Status.DONE)
            return

        frames_dir = job_dir / "frames"
        if render_mode == "remotion":
            render_results = render_scenes_remotion(
                plan.scenes, frames_dir,
                on_scene_done=_on_scene_done,
            )
        else:
            render_results = render_scenes(
                plan.scenes, frames_dir,
                on_scene_done=_on_scene_done,
            )

        # Store per-scene render timing
        job["render_timing"] = [
            {"scene": r.scene_index, "mode": r.mode, "frame_count": r.frame_count,
             "render_time": round(r.render_time, 3)}
            for r in render_results
        ]

        # Stage 5 — TTS
        _notify(Status.SYNTHESIZING_TTS)
        audio_dir = job_dir / "audio"
        narrations = [s.narration for s in plan.scenes]
        mp3_paths, tts_timing = synthesize_all(narrations, audio_dir)

        # Store per-scene TTS timing
        job["tts_timing"] = tts_timing

        if till_stage == "tts":
            _notify(Status.DONE)
            return

        # Stage 6 — Assembly
        _notify(Status.ASSEMBLING)
        final = assemble(render_results, mp3_paths, job_dir)
        job["final_path"] = str(final)

        # Upload to Azure Blob Storage if configured
        conn_str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
        container = os.environ.get("AZURE_STORAGE_CONTAINER", "videos")
        if conn_str:
            try:
                from azure.storage.blob import BlobServiceClient
                blob_service = BlobServiceClient.from_connection_string(conn_str)
                blob_name = f"{job_id}/{final.name}"
                blob_client = blob_service.get_blob_client(container=container, blob=blob_name)
                with open(final, "rb") as f:
                    blob_client.upload_blob(f, overwrite=True, content_settings={
                        "content_type": "video/mp4"
                    })
                job["blob_url"] = blob_client.url
            except Exception as upload_err:
                # Non-fatal — video is still available locally
                job["blob_upload_error"] = str(upload_err)

        _notify(Status.DONE)

    except Exception as exc:
        job["status"] = Status.FAILED
        job["error"] = str(exc)
