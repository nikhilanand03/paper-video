"""Pipeline orchestrator — chains all stages and tracks job status."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
import traceback
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

from pipeline.extract import extract_pdf
from pipeline.planner import plan_scenes
from pipeline.render import render_scenes
from pipeline.tts import synthesize_all, warmup_tts
from pipeline.assembly import assemble


# ── Constants ────────────────────────────────────────────────────────────────

RENDER_MODE = os.environ.get("RENDER_MODE", "html")
OUTPUT_ROOT = Path(__file__).parent.parent / "output"
UPLOADED_PDFS_DIR = Path(__file__).parent.parent / "uploaded-pdfs"


class Status(str, Enum):
    QUEUED = "queued"
    EXTRACTING = "extracting"
    PLANNING = "planning"
    RENDERING = "rendering"
    SYNTHESIZING_TTS = "synthesizing_tts"
    ASSEMBLING = "assembling"
    DONE = "done"
    FAILED = "failed"


PIPELINE_STAGES_FULL = [
    Status.EXTRACTING, Status.PLANNING, Status.RENDERING,
    Status.SYNTHESIZING_TTS, Status.ASSEMBLING, Status.DONE,
]

PIPELINE_STAGES_FRAMES_ONLY = [
    Status.EXTRACTING, Status.PLANNING, Status.RENDERING, Status.DONE,
]

_STAGE_LABELS = {
    Status.EXTRACTING: "Extracting PDF",
    Status.PLANNING: "Planning scenes",
    Status.RENDERING: "Rendering frames",
    Status.SYNTHESIZING_TTS: "Synthesizing TTS",
    Status.ASSEMBLING: "Assembling video",
    Status.DONE: "Done",
}


# ── JobManager ───────────────────────────────────────────────────────────────

class JobManager:
    """Manages job lifecycle: creation, storage, and state tracking."""

    def __init__(self, output_root: Path, uploaded_pdfs_dir: Path):
        self.output_root = output_root
        self.uploaded_pdfs_dir = uploaded_pdfs_dir
        self._jobs: dict[str, dict[str, Any]] = {}

    @staticmethod
    def _sanitize(name: str, max_len: int = 12) -> str:
        """Turn a paper title into a short filesystem-safe slug."""
        name = name.lower().strip()
        words = re.findall(r"[a-z0-9]+", name)
        slug = words[0] if words else "untitled"
        if len(slug) < 4 and len(words) > 1:
            slug = words[0] + words[1]
        return slug[:max_len]

    def _next_run_name(self, slug: str, suffix: str = "") -> str:
        """Find next available name like immuno1, immuno2."""
        existing = sorted(self.output_root.glob(f"{slug}*")) if self.output_root.exists() else []
        max_num = 0
        for p in existing:
            m = re.match(rf"^{re.escape(slug)}(\d+)", p.name)
            if m:
                max_num = max(max_num, int(m.group(1)))
        return f"{slug}{max_num + 1}{suffix}"

    def _store_pdf(self, pdf_path: Path) -> Path:
        """Copy PDF to uploaded-pdfs/ (deduplicated by content hash)."""
        self.uploaded_pdfs_dir.mkdir(parents=True, exist_ok=True)
        content = pdf_path.read_bytes()
        file_hash = hashlib.sha256(content).hexdigest()[:16]
        stored = self.uploaded_pdfs_dir / f"{file_hash}_{pdf_path.name}"
        if not stored.exists():
            stored.write_bytes(content)
        return stored

    def create_job(self, pdf_path: Path, frames_only: bool = False, suffix: str = "") -> str:
        """Create a new job, set up directories, register in memory."""
        pdf_path = Path(pdf_path)
        tmp_slug = self._sanitize(pdf_path.stem)
        if not suffix:
            suffix = "_fo" if frames_only else ""
        job_id = self._next_run_name(tmp_slug, suffix)
        job_dir = self.output_root / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        parent_name = pdf_path.parent.name
        if parent_name not in ("uploaded-pdfs", "sample-pdfs"):
            pdf_path = self._store_pdf(pdf_path)

        meta = {"pdf_path": str(pdf_path.resolve())}
        (job_dir / "job.json").write_text(json.dumps(meta, indent=2))

        self._jobs[job_id] = {
            "status": Status.QUEUED,
            "pdf_path": str(pdf_path),
            "job_dir": str(job_dir),
            "error": None,
            "scenes_total": 0,
            "scenes_done": 0,
        }
        return job_id

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        return self._jobs.get(job_id)


# ── Pipeline ─────────────────────────────────────────────────────────────────

def _persist_status(job: dict, job_dir: Path) -> None:
    """Write current job status to disk so it survives server restarts."""
    data = {
        "pdf_path": job.get("pdf_path"),
        "status": job["status"].value if hasattr(job["status"], "value") else job["status"],
        "error": job.get("error"),
        "scenes_total": job.get("scenes_total", 0),
        "scenes_done": job.get("scenes_done", 0),
    }
    (job_dir / "job.json").write_text(json.dumps(data, indent=2))


class Pipeline:
    """Executes the full extraction → planning → rendering → TTS → assembly pipeline."""

    def __init__(self, job_manager: JobManager):
        self.job_manager = job_manager

    def run(
        self,
        job_id: str,
        on_stage: callable = None,
        frames_only: bool = False,
        till_stage: str | None = None,
    ) -> None:
        """Execute the pipeline for a job.

        Args:
            on_stage: Optional callback(status, label) called when each stage starts.
            frames_only: If True, stop after rendering (skip TTS and assembly).
            till_stage: Stop after this stage ("extract", "plan", "render", "tts").
        """
        job = self.job_manager._jobs[job_id]
        job_dir = Path(job["job_dir"])

        # Per-job log file so every run is inspectable after the fact
        job_log_handler = logging.FileHandler(job_dir / "pipeline.log")
        job_log_handler.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)s [%(name)s] %(message)s", datefmt="%H:%M:%S"
        ))
        pipeline_root = logging.getLogger("pipeline")
        if pipeline_root.level > logging.INFO or pipeline_root.level == logging.NOTSET:
            pipeline_root.setLevel(logging.INFO)
        pipeline_root.addHandler(job_log_handler)

        def _notify(status: Status) -> None:
            job["status"] = status
            logger.info("[%s] %s", job_id, _STAGE_LABELS.get(status, status.value))
            _persist_status(job, job_dir)
            if on_stage:
                on_stage(status, _STAGE_LABELS.get(status, status.value))

        try:
            # Extract
            _notify(Status.EXTRACTING)
            paper = extract_pdf(job["pdf_path"], output_dir=job_dir)
            (job_dir / "extraction.json").write_text(json.dumps(paper, indent=2, default=str))
            job["paper"] = paper

            if till_stage == "extract":
                _notify(Status.DONE)
                return

            # Plan
            _notify(Status.PLANNING)
            plan = plan_scenes(paper, output_dir=job_dir)
            job["scenes_total"] = len(plan.scenes)
            plan_dict = plan.model_dump()
            (job_dir / "plan.json").write_text(json.dumps(plan_dict, indent=2, default=str))
            job["plan"] = plan_dict

            if till_stage == "plan":
                _notify(Status.DONE)
                return

            # Render
            _notify(Status.RENDERING)

            if not frames_only and till_stage not in ("render",):
                threading.Thread(target=warmup_tts, daemon=True).start()

            def _on_scene_done(n: int) -> None:
                job["scenes_done"] = n
                _persist_status(job, job_dir)

            render_mode = os.environ.get("RENDER_MODE", RENDER_MODE)

            if frames_only or till_stage == "render":
                render_results = render_scenes(
                    plan.scenes, job_dir / "preview", preview_only=True,
                    on_scene_done=_on_scene_done,
                )
                _notify(Status.DONE)
                return

            frames_dir = job_dir / "frames"
            if render_mode == "remotion":
                from pipeline.render_remotion import render_scenes_remotion
                render_results = render_scenes_remotion(
                    plan.scenes, frames_dir, on_scene_done=_on_scene_done,
                )
            else:
                render_results = render_scenes(
                    plan.scenes, frames_dir, on_scene_done=_on_scene_done,
                )

            job["render_timing"] = [
                {"scene": r.scene_index, "mode": r.mode, "frame_count": r.frame_count,
                 "render_time": round(r.render_time, 3)}
                for r in render_results
            ]

            # TTS
            _notify(Status.SYNTHESIZING_TTS)
            narrations = [s.narration for s in plan.scenes]
            mp3_paths, tts_timing = synthesize_all(narrations, job_dir / "audio")
            job["tts_timing"] = tts_timing

            if till_stage == "tts":
                _notify(Status.DONE)
                return

            # Assembly
            _notify(Status.ASSEMBLING)
            final = assemble(render_results, mp3_paths, job_dir)
            job["final_path"] = str(final)

            # Optional: upload to Azure Blob Storage
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
                    job["blob_upload_error"] = str(upload_err)

            _notify(Status.DONE)

        except Exception as exc:
            logger.error("Pipeline %s failed: %s\n%s", job_id, exc, traceback.format_exc())
            job["status"] = Status.FAILED
            job["error"] = str(exc)
            _persist_status(job, job_dir)
        finally:
            pipeline_root.removeHandler(job_log_handler)
            job_log_handler.close()


# ── Default instances + backward-compat free functions ───────────────────────

_default_manager = JobManager(OUTPUT_ROOT, UPLOADED_PDFS_DIR)
_default_pipeline = Pipeline(_default_manager)

# Expose _jobs for direct access (used by tests/conftest.py)
_jobs = _default_manager._jobs


def create_job(pdf_path: Path, frames_only: bool = False, suffix: str = "") -> str:
    return _default_manager.create_job(pdf_path, frames_only, suffix)


def get_job(job_id: str) -> dict[str, Any] | None:
    return _default_manager.get_job(job_id)


def run_pipeline(
    job_id: str,
    on_stage: callable = None,
    frames_only: bool = False,
    till_stage: str | None = None,
) -> None:
    return _default_pipeline.run(job_id, on_stage, frames_only, till_stage)


# Keep _sanitize and _next_run_name accessible for tests
_sanitize = JobManager._sanitize
_next_run_name = _default_manager._next_run_name
