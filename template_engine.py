"""Template engine — injects scene data into HTML templates."""

from __future__ import annotations

import json
from pathlib import Path

from template_registry import TemplateMeta

TEMPLATES_DIR = Path(__file__).parent / "templates"


def _resolve_image_paths(data: dict) -> dict:
    """Convert any file paths in scene data to absolute file:// URIs."""
    resolved = {}
    for key, value in data.items():
        if isinstance(value, str) and ("/" in value or "\\" in value):
            p = Path(value)
            if p.exists() and p.is_file():
                resolved[key] = p.resolve().as_uri()
            else:
                resolved[key] = value
        else:
            resolved[key] = value
    return resolved


def prepare_scene_html(template: TemplateMeta, data: dict) -> str:
    """Read the template file and inject window.SCENE_DATA + resolve theme.css path."""
    html = template.path.read_text(encoding="utf-8")

    # Resolve theme.css to absolute file:// URI
    theme_uri = (TEMPLATES_DIR / "theme.css").resolve().as_uri()
    html = html.replace('href="../theme.css"', f'href="{theme_uri}"')

    # Resolve image paths to absolute file:// URIs
    data = _resolve_image_paths(data)

    # Inject SCENE_DATA as a script block right before </head>
    data_script = (
        f"<script>window.SCENE_DATA = {json.dumps(data, ensure_ascii=False)};</script>"
    )
    html = html.replace("</head>", f"{data_script}\n</head>")

    return html


def prepare_scene_html_web(template: TemplateMeta, data: dict) -> str:
    """Like prepare_scene_html but resolves theme.css to /api/theme.css for browser use."""
    html = template.path.read_text(encoding="utf-8")

    # Resolve theme.css to API endpoint instead of file:// URI
    html = html.replace('href="../theme.css"', 'href="/api/theme.css"')

    # Inject SCENE_DATA as a script block right before </head>
    data_script = (
        f"<script>window.SCENE_DATA = {json.dumps(data, ensure_ascii=False)};</script>"
    )
    html = html.replace("</head>", f"{data_script}\n</head>")

    return html
