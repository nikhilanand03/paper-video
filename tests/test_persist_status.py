"""Tests for job status persistence, recovery, and pipeline logging.

Covers:
  - _persist_status writes correct fields to job.json
  - Status/error survives server restart (job removed from _jobs)
  - Pipeline failure persists error + traceback to disk
  - Per-job pipeline.log file is created with content
  - All pipeline modules have named loggers
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class TestPersistStatus:
    """Unit tests for _persist_status helper."""

    def test_writes_status_and_progress(self, tmp_output, mock_pdf):
        """_persist_status writes status, error, scenes to job.json."""
        import pipeline
        from pipeline.orchestrator import _persist_status, Status

        job_id = pipeline.create_job(mock_pdf)
        job = pipeline.get_job(job_id)
        job["status"] = Status.RENDERING
        job["scenes_total"] = 12
        job["scenes_done"] = 7

        job_dir = Path(job["job_dir"])
        _persist_status(job, job_dir)

        data = json.loads((job_dir / "job.json").read_text())
        assert data["status"] == "rendering"
        assert data["scenes_total"] == 12
        assert data["scenes_done"] == 7
        assert data["error"] is None

    def test_writes_error_field(self, tmp_output, mock_pdf):
        """_persist_status writes the error message to disk."""
        import pipeline
        from pipeline.orchestrator import _persist_status, Status

        job_id = pipeline.create_job(mock_pdf)
        job = pipeline.get_job(job_id)
        job["status"] = Status.FAILED
        job["error"] = "Reducto API timeout after 120s"

        job_dir = Path(job["job_dir"])
        _persist_status(job, job_dir)

        data = json.loads((job_dir / "job.json").read_text())
        assert data["status"] == "failed"
        assert data["error"] == "Reducto API timeout after 120s"

    def test_writes_blob_url(self, tmp_output, mock_pdf):
        """_persist_status includes blob_url when present in job dict."""
        import pipeline
        from pipeline.orchestrator import _persist_status, Status

        job_id = pipeline.create_job(mock_pdf)
        job = pipeline.get_job(job_id)
        job["status"] = Status.DONE
        job["blob_url"] = "https://banimvideostorage.blob.core.windows.net/videos/test/final.mp4"

        job_dir = Path(job["job_dir"])
        _persist_status(job, job_dir)

        data = json.loads((job_dir / "job.json").read_text())
        assert data["blob_url"] == "https://banimvideostorage.blob.core.windows.net/videos/test/final.mp4"

    def test_writes_null_blob_url_when_absent(self, tmp_output, mock_pdf):
        """_persist_status writes null blob_url when no Azure upload happened."""
        import pipeline
        from pipeline.orchestrator import _persist_status, Status

        job_id = pipeline.create_job(mock_pdf)
        job = pipeline.get_job(job_id)
        job["status"] = Status.RENDERING

        job_dir = Path(job["job_dir"])
        _persist_status(job, job_dir)

        data = json.loads((job_dir / "job.json").read_text())
        assert data["blob_url"] is None

    def test_preserves_pdf_path(self, tmp_output, mock_pdf):
        """_persist_status keeps pdf_path from the original job dict."""
        import pipeline
        from pipeline.orchestrator import _persist_status, Status

        job_id = pipeline.create_job(mock_pdf)
        job = pipeline.get_job(job_id)
        original_pdf = job["pdf_path"]
        job["status"] = Status.EXTRACTING

        job_dir = Path(job["job_dir"])
        _persist_status(job, job_dir)

        data = json.loads((job_dir / "job.json").read_text())
        assert data["pdf_path"] == original_pdf


class TestPipelineFailurePersistence:
    """Integration tests: pipeline failure persists error to disk."""

    def test_error_persisted_on_extraction_failure(self, tmp_output, mock_pdf):
        """When extract_pdf raises, error is written to job.json on disk."""
        import pipeline

        job_id = pipeline.create_job(mock_pdf)

        with patch(
            "pipeline.orchestrator.extract_pdf",
            side_effect=RuntimeError("Reducto API exploded"),
        ):
            pipeline.run_pipeline(job_id)

        # In-memory state
        job = pipeline.get_job(job_id)
        assert job["status"].value == "failed"
        assert "Reducto API exploded" in job["error"]

        # Disk state
        job_dir = Path(job["job_dir"])
        data = json.loads((job_dir / "job.json").read_text())
        assert data["status"] == "failed"
        assert "Reducto API exploded" in data["error"]

    def test_error_persisted_on_planning_failure(self, tmp_output, mock_pdf):
        """When plan_scenes raises, status shows planning was the last stage."""
        import pipeline

        job_id = pipeline.create_job(mock_pdf)
        fake_paper = {"title": "T", "authors": [], "sections": [], "tables": [], "figures": []}

        with patch("pipeline.orchestrator.extract_pdf", return_value=fake_paper), \
             patch("pipeline.orchestrator.plan_scenes", side_effect=ValueError("LLM returned invalid JSON")):
            pipeline.run_pipeline(job_id)

        job_dir = Path(pipeline.get_job(job_id)["job_dir"])
        data = json.loads((job_dir / "job.json").read_text())
        assert data["status"] == "failed"
        assert "invalid JSON" in data["error"]

    def test_status_recoverable_after_memory_loss(self, client, tmp_output, mock_pdf):
        """After removing job from _jobs (simulating restart), /status reads disk."""
        import pipeline

        job_id = pipeline.create_job(mock_pdf)

        with patch(
            "pipeline.orchestrator.extract_pdf",
            side_effect=RuntimeError("Network timeout"),
        ):
            pipeline.run_pipeline(job_id)

        # Simulate server restart: clear in-memory state
        del pipeline._jobs[job_id]

        # /status should still work via disk fallback
        resp = client.get(f"/status/{job_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "failed"
        assert "Network timeout" in body["error"]


class TestPipelineLogFile:
    """Tests for per-job pipeline.log creation."""

    def test_log_file_created_on_success(self, tmp_output, mock_pdf):
        """Successful pipeline run creates pipeline.log."""
        import pipeline
        from pipeline.orchestrator import _persist_status, Status
        from pydantic import BaseModel

        job_id = pipeline.create_job(mock_pdf)
        fake_paper = {"title": "T", "authors": [], "sections": [], "tables": [], "figures": []}

        class FakePlan:
            scenes = []
            def model_dump(self): return {"scenes": []}

        with patch("pipeline.orchestrator.extract_pdf", return_value=fake_paper), \
             patch("pipeline.orchestrator.plan_scenes", return_value=FakePlan()), \
             patch("pipeline.render_remotion.render_scenes_remotion", return_value=[]), \
             patch("pipeline.orchestrator.warmup_tts"), \
             patch("pipeline.orchestrator.synthesize_all", return_value=([], [])), \
             patch("pipeline.orchestrator.assemble", return_value=Path("/fake/final.mp4")):
            pipeline.run_pipeline(job_id)

        job_dir = Path(pipeline.get_job(job_id)["job_dir"])
        log_file = job_dir / "pipeline.log"
        assert log_file.exists()

    def test_log_file_contains_stage_transitions(self, tmp_output, mock_pdf):
        """pipeline.log records stage transition messages."""
        import pipeline

        job_id = pipeline.create_job(mock_pdf)

        with patch(
            "pipeline.orchestrator.extract_pdf",
            side_effect=RuntimeError("fail early"),
        ):
            pipeline.run_pipeline(job_id)

        job_dir = Path(pipeline.get_job(job_id)["job_dir"])
        content = (job_dir / "pipeline.log").read_text()
        assert "Extracting PDF" in content

    def test_log_file_contains_error_traceback(self, tmp_output, mock_pdf):
        """pipeline.log includes traceback on failure."""
        import pipeline

        job_id = pipeline.create_job(mock_pdf)

        with patch(
            "pipeline.orchestrator.extract_pdf",
            side_effect=RuntimeError("kaboom"),
        ):
            pipeline.run_pipeline(job_id)

        job_dir = Path(pipeline.get_job(job_id)["job_dir"])
        content = (job_dir / "pipeline.log").read_text()
        assert "kaboom" in content
        assert "Traceback" in content or "RuntimeError" in content

    def test_log_file_cleaned_up_after_run(self, tmp_output, mock_pdf):
        """File handler is removed after pipeline completes (no handler leak)."""
        import pipeline

        pipeline_logger = logging.getLogger("pipeline")
        handlers_before = len(pipeline_logger.handlers)

        job_id = pipeline.create_job(mock_pdf)
        with patch(
            "pipeline.orchestrator.extract_pdf",
            side_effect=RuntimeError("test"),
        ):
            pipeline.run_pipeline(job_id)

        handlers_after = len(pipeline_logger.handlers)
        assert handlers_after == handlers_before


class TestStageLoggers:
    """Verify each pipeline module has a logger."""

    @pytest.mark.parametrize("module_path", [
        "pipeline.extract",
        "pipeline.planner",
        "pipeline.render",
        "pipeline.tts",
        "pipeline.assembly",
        "pipeline.orchestrator",
    ])
    def test_module_has_logger(self, module_path):
        """Each pipeline module exposes a logger instance."""
        import importlib
        mod = importlib.import_module(module_path)
        assert hasattr(mod, "logger"), f"{module_path} missing logger"
        assert isinstance(mod.logger, logging.Logger)
        assert mod.logger.name == module_path
