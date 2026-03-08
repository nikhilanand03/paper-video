"""Tests for the /job/{job_id}/data endpoint."""

from __future__ import annotations

import json


def test_job_data_from_disk(client, tmp_output):
    """Extraction + plan files on disk are returned correctly."""
    job_id = "datajob1"
    job_dir = tmp_output["output"] / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    extraction = {"title": "My Paper", "authors": ["Alice"]}
    plan = {"scenes": [{"template": "title_card"}]}

    (job_dir / "extraction.json").write_text(json.dumps(extraction))
    (job_dir / "plan.json").write_text(json.dumps(plan))

    resp = client.get(f"/job/{job_id}/data")
    assert resp.status_code == 200
    body = resp.json()
    assert "paper" in body
    assert body["paper"]["title"] == "My Paper"
    assert "plan" in body
    assert len(body["plan"]["scenes"]) == 1


def test_job_not_found(client):
    """GET data for a nonexistent job returns 404."""
    resp = client.get("/job/nonexistent_job_xyz/data")
    assert resp.status_code == 404
