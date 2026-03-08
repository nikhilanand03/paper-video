"""Tests for the /upload endpoint."""

from __future__ import annotations

import io
from unittest.mock import patch


def test_upload_valid_pdf(client, mock_pdf):
    """POST a valid PDF file; expect 200 with a job_id."""
    with open(mock_pdf, "rb") as f:
        with patch("app.threading.Thread") as mock_thread:
            # Prevent the pipeline from actually running
            mock_thread.return_value.start = lambda: None
            resp = client.post(
                "/upload",
                files={"file": ("paper.pdf", f, "application/pdf")},
            )
    assert resp.status_code == 200
    body = resp.json()
    assert "job_id" in body
    assert isinstance(body["job_id"], str)
    assert len(body["job_id"]) > 0


def test_upload_non_pdf_rejected(client):
    """POST a .txt file; expect 400."""
    resp = client.post(
        "/upload",
        files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert resp.status_code == 400


def test_upload_no_file(client):
    """POST with no file field; expect 422 (validation error)."""
    resp = client.post("/upload")
    assert resp.status_code == 422
