"""Tests for the template / playground API endpoints."""

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
    # We know title_card should be in layout
    assert "title_card" in body["layout"]
    # And bar_chart should be in charts
    assert "bar_chart" in body["charts"]


def test_template_preview(client):
    """POST to /api/template-preview/title_card returns rendered HTML."""
    data = {"title": "Hello World", "subtitle": "A subtitle"}
    resp = client.post("/api/template-preview/title_card", json=data)
    assert resp.status_code == 200
    body = resp.json()
    assert "html" in body
    assert "Hello World" in body["html"]


def test_unknown_template(client):
    """POST to /api/template-preview with an unknown name returns 404."""
    resp = client.post("/api/template-preview/does_not_exist", json={"foo": "bar"})
    assert resp.status_code == 404


def test_theme_css(client):
    """GET /api/theme.css returns 200 with text/css content type."""
    resp = client.get("/api/theme.css")
    # theme.css exists in the templates/ dir
    assert resp.status_code == 200
    assert "text/css" in resp.headers["content-type"]
