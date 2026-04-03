"""Shared fixtures for the banim test suite."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

# Ensure project root is on sys.path so we can import app, pipeline, etc.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


@pytest.fixture()
def tmp_output(tmp_path, monkeypatch):
    """Redirect pipeline.OUTPUT_ROOT and pipeline.UPLOADED_PDFS_DIR to tmp dirs.

    Also patches the copies that app.py imports by value.
    """
    out = tmp_path / "output"
    out.mkdir()
    pdfs = tmp_path / "uploaded-pdfs"
    pdfs.mkdir()

    import pipeline
    import app as app_mod

    monkeypatch.setattr(pipeline, "OUTPUT_ROOT", out)
    monkeypatch.setattr(pipeline, "UPLOADED_PDFS_DIR", pdfs)
    # Patch the default JobManager instance so create_job/get_job use tmp dirs
    monkeypatch.setattr(pipeline._default_manager, "output_root", out)
    monkeypatch.setattr(pipeline._default_manager, "uploaded_pdfs_dir", pdfs)
    # app.py does `from pipeline import OUTPUT_ROOT, UPLOADED_PDFS_DIR`
    monkeypatch.setattr(app_mod, "OUTPUT_ROOT", out)
    monkeypatch.setattr(app_mod, "UPLOADED_PDFS_DIR", pdfs)

    return {"output": out, "pdfs": pdfs}


@pytest.fixture()
def client(tmp_output):
    """FastAPI TestClient with output dirs pointed at tmp_path."""
    # Ensure the 'static' directory exists so StaticFiles mount doesn't blow up.
    static_dir = PROJECT_ROOT / "static"
    os.makedirs(static_dir, exist_ok=True)

    from starlette.testclient import TestClient
    from app import app

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture()
def mock_pdf(tmp_path) -> Path:
    """Create a minimal valid PDF file using PyMuPDF (fitz)."""
    import fitz  # PyMuPDF

    pdf_path = tmp_path / "sample.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Hello, this is a test PDF.")
    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


@pytest.fixture()
def seeded_job(tmp_output):
    """Create a completed job directory with extraction.json, plan.json, and final.mp4."""
    import pipeline

    job_id = "testjob1"
    job_dir = tmp_output["output"] / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    extraction = {
        "title": "Test Paper",
        "authors": ["Author A"],
        "abstract": "An abstract.",
    }
    plan = {
        "scenes": [
            {"template": "title_card", "data": {"title": "Test"}, "narration": "Hello"},
        ],
    }

    (job_dir / "extraction.json").write_text(json.dumps(extraction))
    (job_dir / "plan.json").write_text(json.dumps(plan))

    # Create a tiny dummy mp4 (just bytes, not a real video, but enough for tests)
    (job_dir / "final.mp4").write_bytes(b"\x00\x00\x00\x1cftypisom" + b"\x00" * 50)

    # Also register in pipeline._jobs so get_job works
    pipeline._jobs[job_id] = {
        "status": pipeline.Status.DONE,
        "pdf_path": "/dev/null",
        "job_dir": str(job_dir),
        "error": None,
        "scenes_total": 1,
        "scenes_done": 1,
        "final_path": str(job_dir / "final.mp4"),
        "paper": extraction,
        "plan": plan,
    }

    return {
        "job_id": job_id,
        "job_dir": job_dir,
        "extraction": extraction,
        "plan": plan,
    }
