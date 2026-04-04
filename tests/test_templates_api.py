"""Tests for the template API endpoints."""

from __future__ import annotations


def test_list_templates(client):
    """GET /api/templates returns layout and charts keys."""
    resp = client.get("/api/templates")
    assert resp.status_code == 200
    body = resp.json()
    assert "layout" in body
    assert "charts" in body
    assert isinstance(body["layout"], list)
    assert isinstance(body["charts"], list)
    assert "title_card" in body["layout"]
    assert "bar_chart" in body["charts"]
