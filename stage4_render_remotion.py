"""Stage 4 (Remotion): Render scenes to MP4 using Remotion compositions.

Replaces Playwright HTML rendering with Remotion's CLI renderer.
Each scene is rendered as a standalone MP4 file at 1920x1080 / 30fps.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from stage4_render import SceneRenderResult
from template_registry import get_template

FPS = 30
# Minimum render duration — ensures all entrance animations complete
MIN_DURATION_SECONDS = 7
MAX_CONCURRENT = int(os.environ.get("RENDER_CONCURRENCY", "4"))
REMOTION_DIR = Path(__file__).parent / "remotion-presets"


# ─────────────────────────────────────────────────────────────────────────────
# Props adapter: snake_case (Python/LLM) → camelCase (React/Zod)
# ─────────────────────────────────────────────────────────────────────────────

def _snake_to_camel(key: str) -> str:
    """Convert snake_case to camelCase."""
    parts = key.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def _convert_keys(obj: Any) -> Any:
    """Recursively convert all dict keys from snake_case to camelCase."""
    if isinstance(obj, dict):
        return {_snake_to_camel(k): _convert_keys(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_keys(item) for item in obj]
    return obj


def adapt_props(template_name: str, data: dict) -> dict:
    """Adapt LLM-generated scene data to Remotion prop format.

    Handles field renaming and structural differences between the
    HTML template data format and Remotion Zod schemas.
    """
    props = _convert_keys(data)

    # Template-specific overrides where the schema differs
    if template_name == "title_card":
        # TitleCard expects authors as [{name, affiliation?}]
        # LLM may pass them as strings — normalize
        if "authors" in props and props["authors"]:
            authors = props["authors"]
            if isinstance(authors[0], str):
                props["authors"] = [{"name": a} for a in authors]

    if template_name == "section_header":
        # SectionHeaderSchema expects sectionNumber as a number
        # LLM may pass "01" or "1" as string
        if "sectionNumber" in props:
            try:
                props["sectionNumber"] = int(props["sectionNumber"])
            except (ValueError, TypeError):
                props["sectionNumber"] = 1

    if template_name in ("bullet_list", "flashcard_list"):
        # BulletSlide/FlashcardList expect items as strings or {text}
        # LLM output is already in this format
        pass

    if template_name == "big_number":
        # BigNumberScene expects {label, value, unit?, description?}
        # Ensure value is a string
        if "value" in props:
            props["value"] = str(props["value"])

    if template_name in ("pie_donut_chart", "donut_chart"):
        # DonutChartSchema uses centerValue/centerLabel
        # LLM outputs center_value/center_label → converted by _convert_keys
        pass

    if template_name == "horizontal_bar_chart":
        # HorizontalBarChartSchema uses highlightLabel
        # LLM outputs highlight_label → converted by _convert_keys
        pass

    return props


# ─────────────────────────────────────────────────────────────────────────────
# Remotion rendering
# ─────────────────────────────────────────────────────────────────────────────

def _render_remotion_scene(
    scene,
    index: int,
    output_dir: Path,
) -> SceneRenderResult:
    """Render a single scene using Remotion CLI → MP4."""
    t0 = time.monotonic()
    tmpl = get_template(scene.template)

    if not tmpl.has_remotion:
        raise ValueError(
            f"Template '{scene.template}' has no Remotion composition. "
            f"Use HTML renderer for this scene."
        )

    comp_id = tmpl.remotion_comp_id
    props = adapt_props(scene.template, scene.data)
    props_json = json.dumps(props)

    out_path = output_dir / f"scene_{index:03d}.mp4"

    cmd = [
        "npx", "remotion", "render",
        comp_id,
        str(out_path),
        "--props", props_json,
        "--codec", "h264",
        "--crf", "18",
    ]

    result = subprocess.run(
        cmd,
        cwd=str(REMOTION_DIR),
        capture_output=True,
        text=True,
        timeout=300,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Remotion render failed for scene {index} ({comp_id}):\n"
            f"{result.stderr[:800]}"
        )

    render_time = time.monotonic() - t0

    return SceneRenderResult(
        scene_index=index,
        mode="video",
        video_path=out_path,
        hold_frame_path=None,  # Not needed — video is self-contained
        render_time=render_time,
    )


def _render_one(args: tuple) -> SceneRenderResult:
    """Worker function for parallel rendering."""
    scene, index, output_dir = args
    return _render_remotion_scene(scene, index, output_dir)


def _warmup_remotion() -> None:
    """Pre-bundle the Remotion project so first render doesn't timeout."""
    bundle_marker = REMOTION_DIR / "node_modules" / ".cache" / ".remotion-bundled"
    if bundle_marker.exists():
        return
    try:
        subprocess.run(
            ["npx", "remotion", "bundle"],
            cwd=str(REMOTION_DIR),
            capture_output=True,
            text=True,
            timeout=180,
        )
        bundle_marker.parent.mkdir(parents=True, exist_ok=True)
        bundle_marker.touch()
    except Exception:
        pass  # Non-fatal — first render will just be slower


def render_scenes_remotion(
    scenes: list,
    output_dir: Path,
    on_scene_done: callable = None,
) -> list[SceneRenderResult]:
    """Render all scenes using Remotion, falling back to HTML for unsupported templates.

    Returns list of SceneRenderResult in scene order.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Pre-bundle to avoid timeout on first render
    _warmup_remotion()

    # Check which scenes have Remotion support
    tasks = []
    for i, scene in enumerate(scenes):
        tmpl = get_template(scene.template)
        if tmpl.has_remotion:
            tasks.append((scene, i, output_dir))
        else:
            # Will be handled by fallback below
            tasks.append(None)

    results: list[SceneRenderResult | None] = [None] * len(scenes)
    completed = 0

    def _on_done(future_result):
        nonlocal completed
        completed += 1
        if on_scene_done:
            on_scene_done(completed)

    # Render Remotion scenes in parallel
    remotion_tasks = [(t, i) for i, t in enumerate(tasks) if t is not None]

    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as pool:
        futures = {}
        for task_args, original_idx in remotion_tasks:
            future = pool.submit(_render_one, task_args)
            futures[future] = original_idx

        for future in futures:
            result = future.result()
            idx = futures[future]
            results[idx] = result
            _on_done(result)

    # Fallback: render any scenes without Remotion using HTML renderer
    fallback_scenes = [
        (i, scenes[i]) for i in range(len(scenes)) if results[i] is None
    ]
    if fallback_scenes:
        from stage4_render import render_scenes as render_html

        fallback_scene_list = [s for _, s in fallback_scenes]
        fallback_dir = output_dir / "html_fallback"
        html_results = render_html(
            fallback_scene_list, fallback_dir,
            on_scene_done=lambda n: None,
        )
        for (orig_idx, _), html_result in zip(fallback_scenes, html_results):
            html_result.scene_index = orig_idx
            results[orig_idx] = html_result
            completed += 1
            if on_scene_done:
                on_scene_done(completed)

    return results
