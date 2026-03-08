"""Tests for /stream/{job_id} and /download/{job_id} endpoints."""

from __future__ import annotations


def test_stream_video(client, seeded_job):
    """GET /stream returns 200 with video/mp4 content type."""
    resp = client.get(f"/stream/{seeded_job['job_id']}")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("video/mp4")


def test_download_video(client, seeded_job):
    """GET /download returns 200 with content-disposition attachment."""
    resp = client.get(f"/download/{seeded_job['job_id']}")
    assert resp.status_code == 200
    assert "content-disposition" in resp.headers
    disp = resp.headers["content-disposition"]
    assert "attachment" in disp
    assert seeded_job["job_id"] in disp


def test_stream_not_found(client):
    """GET /stream for a nonexistent job returns 404."""
    resp = client.get("/stream/nonexistent_job_xyz")
    assert resp.status_code == 404
