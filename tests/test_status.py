"""Tests for the /status/{job_id} endpoint."""

from __future__ import annotations

import json


def test_status_existing_job(client, seeded_job):
    """GET status for an in-memory job returns 200 with correct fields."""
    resp = client.get(f"/status/{seeded_job['job_id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "done"
    assert body["error"] is None
    assert body["scenes_total"] == 1
    assert body["scenes_done"] == 1


def test_status_not_found(client):
    """GET status for a nonexistent job returns 404."""
    resp = client.get("/status/nonexistent_job_xyz")
    assert resp.status_code == 404


def test_status_from_disk(client, tmp_output):
    """If the job is only on disk (not in _jobs), the endpoint reconstructs it."""
    job_id = "diskjob1"
    job_dir = tmp_output["output"] / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    planned = job_dir / "planned_outputs"
    planned.mkdir()
    plan = {"scenes": [{"template": "title_card"}, {"template": "big_number"}]}
    (planned / "full_plan.json").write_text(json.dumps(plan))
    (job_dir / "final.mp4").write_bytes(b"\x00" * 20)

    resp = client.get(f"/status/{job_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "done"
    assert body["scenes_total"] == 2
    assert body["scenes_done"] == 2
