"""Tests for pipeline utility functions."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline import _sanitize, _next_run_name, create_job, _jobs, OUTPUT_ROOT


class TestSanitize:
    """Tests for _sanitize (title -> filesystem slug)."""

    def test_basic_word(self):
        assert _sanitize("Immunology Today") == "immunology"

    def test_short_word_gets_merged(self):
        """If the first word is < 4 chars, first two words are merged."""
        result = _sanitize("An Overview")
        assert result == "anoverview"

    def test_empty_string(self):
        assert _sanitize("") == "untitled"

    def test_special_characters(self):
        result = _sanitize("Hello-World! 2024")
        assert result == "hello"

    def test_max_length(self):
        result = _sanitize("supercalifragilistic", max_len=8)
        assert len(result) <= 8


class TestNextRunName:
    """Tests for _next_run_name (sequential run naming)."""

    def test_first_run(self, tmp_path, monkeypatch):
        import pipeline
        monkeypatch.setattr(pipeline, "OUTPUT_ROOT", tmp_path)
        monkeypatch.setattr(pipeline._default_manager, "output_root", tmp_path)
        name = _next_run_name("test")
        assert name == "test1"

    def test_increments(self, tmp_path, monkeypatch):
        import pipeline
        monkeypatch.setattr(pipeline, "OUTPUT_ROOT", tmp_path)
        monkeypatch.setattr(pipeline._default_manager, "output_root", tmp_path)
        (tmp_path / "test1").mkdir()
        (tmp_path / "test2").mkdir()
        name = _next_run_name("test")
        assert name == "test3"

    def test_with_suffix(self, tmp_path, monkeypatch):
        import pipeline
        monkeypatch.setattr(pipeline, "OUTPUT_ROOT", tmp_path)
        monkeypatch.setattr(pipeline._default_manager, "output_root", tmp_path)
        name = _next_run_name("demo", suffix="_fo")
        assert name == "demo1_fo"


class TestCreateJob:
    """Tests for create_job."""

    def test_creates_dir_and_registers(self, tmp_path, monkeypatch, mock_pdf):
        import pipeline

        out = tmp_path / "output"
        out.mkdir()
        pdfs = tmp_path / "uploaded-pdfs"
        pdfs.mkdir()
        monkeypatch.setattr(pipeline, "OUTPUT_ROOT", out)
        monkeypatch.setattr(pipeline, "UPLOADED_PDFS_DIR", pdfs)
        monkeypatch.setattr(pipeline._default_manager, "output_root", out)
        monkeypatch.setattr(pipeline._default_manager, "uploaded_pdfs_dir", pdfs)

        job_id = create_job(mock_pdf)

        # Job directory was created
        job_dir = out / job_id
        assert job_dir.is_dir()

        # job.json was written
        meta = json.loads((job_dir / "job.json").read_text())
        assert "pdf_path" in meta

        # Job is registered in _jobs
        assert job_id in _jobs
        assert _jobs[job_id]["status"].value == "queued"
