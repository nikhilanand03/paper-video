"""Stage 4 (Remotion): Render scenes to MP4 using Remotion compositions.

Replaces Playwright HTML rendering with Remotion's CLI renderer.
Each scene is rendered as a standalone MP4 file at 1920x1080 / 30fps.
"""

from __future__ import annotations

import base64
import json
import logging
import mimetypes
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from pipeline.render import SceneRenderResult
from pipeline.template_registry import get_template

logger = logging.getLogger(__name__)

FPS = 30
# Minimum render duration — ensures all entrance animations complete
MIN_DURATION_SECONDS = 7
MAX_CONCURRENT = int(os.environ.get("RENDER_CONCURRENCY", "4"))
REMOTION_DIR = Path(__file__).parent.parent / "remotion-presets"


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


def _ensure_list(val: Any, fallback: list | None = None) -> list:
    """Coerce a value to a list. Empty strings and None become []."""
    if val is None or val == "":
        return fallback if fallback is not None else []
    if isinstance(val, list):
        return val
    return [val]


def _ensure_num(val: Any, fallback: float = 0) -> float | int:
    """Coerce a value to a number. Strings are parsed, failures return fallback."""
    if isinstance(val, (int, float)):
        return val
    try:
        return float(val)
    except (ValueError, TypeError):
        return fallback


def _ensure_str(val: Any, fallback: str = "") -> str:
    """Coerce a value to a string."""
    if val is None:
        return fallback
    return str(val)


def adapt_props(template_name: str, data: dict) -> dict:
    """Adapt LLM-generated scene data to Remotion prop format.

    Handles field renaming and structural differences between the
    HTML template data format and Remotion Zod schemas. Defensively
    coerces types so any LLM output produces valid Remotion props.
    """
    props = _convert_keys(data)

    # ── title_card: authors must be [{name, affiliation?}] ──
    if template_name == "title_card":
        authors = _ensure_list(props.get("authors"))
        if authors and isinstance(authors[0], str):
            authors = [{"name": a} for a in authors if a.strip()]
        props["authors"] = authors

    # ── image_with_caption: imagePath → imageSrc (as data URI), callouts → annotations ──
    if template_name == "image_with_caption":
        if "imagePath" in props:
            props["imageSrc"] = props.pop("imagePath")
        # Convert local file paths to data URIs so Remotion can render them
        src = props.get("imageSrc", "")
        if src and not src.startswith(("http://", "https://", "data:")):
            if Path(src).is_file():
                mime = mimetypes.guess_type(src)[0] or "image/png"
                b64 = base64.b64encode(Path(src).read_bytes()).decode()
                props["imageSrc"] = f"data:{mime};base64,{b64}"
            else:
                # Invalid path (e.g. "table_0" key) — use a 1x1 transparent PNG placeholder
                logger.warning("  ImageSlide scene has invalid imageSrc: %s — using placeholder", src)
                props["imageSrc"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        if "callouts" in props:
            annotations = []
            for c in _ensure_list(props.pop("callouts")):
                if isinstance(c, dict):
                    annotations.append({
                        "x": _ensure_num(c.get("x", 0)),
                        "y": _ensure_num(c.get("y", 0)),
                        "width": _ensure_num(c.get("width", 10)),
                        "height": _ensure_num(c.get("height", 10)),
                        "label": _ensure_str(c.get("label", "")),
                    })
            if annotations:
                props["annotations"] = annotations

    # ── section_header: sectionNumber must be int ──
    if template_name == "section_header":
        if "sectionNumber" in props:
            props["sectionNumber"] = int(_ensure_num(props["sectionNumber"], 1))

    # ── big_number: value must be string ──
    if template_name == "big_number":
        if "value" in props:
            props["value"] = _ensure_str(props["value"])

    # ── multi_metric_cards: each metric.value must be string ──
    if template_name == "multi_metric_cards":
        for m in _ensure_list(props.get("metrics")):
            if isinstance(m, dict) and "value" in m:
                m["value"] = _ensure_str(m["value"])

    # ── donut/pie: centerValue must be string, values must be numbers ──
    if template_name in ("pie_donut_chart", "donut_chart"):
        if "centerValue" in props:
            props["centerValue"] = _ensure_str(props["centerValue"])
        if "values" in props:
            props["values"] = [_ensure_num(v) for v in _ensure_list(props["values"])]

    # ── bullet_list / flashcard_list: items must be list ──
    if template_name in ("bullet_list", "flashcard_list"):
        if "items" in props:
            props["items"] = _ensure_list(props["items"])

    # ── comparison_split: left/right.points must be lists ──
    if template_name == "comparison_split":
        for side in ("left", "right"):
            panel = props.get(side)
            if isinstance(panel, dict) and "points" in panel:
                panel["points"] = _ensure_list(panel["points"])

    # ── data_table: columns and rows must be lists ──
    if template_name == "data_table":
        props["columns"] = _ensure_list(props.get("columns"))
        rows = _ensure_list(props.get("rows"))
        # Ensure each row is a list of strings
        props["rows"] = [
            [_ensure_str(cell) for cell in _ensure_list(row)]
            for row in rows
        ]

    # ── Charts: coerce numeric values in data arrays ──
    if template_name == "bar_chart":
        for item in _ensure_list(props.get("data")):
            if isinstance(item, dict) and "value" in item:
                item["value"] = _ensure_num(item["value"])

    if template_name in ("grouped_bar_chart", "line_chart"):
        for ds in _ensure_list(props.get("datasets")):
            if isinstance(ds, dict) and "values" in ds:
                ds["values"] = [_ensure_num(v) for v in _ensure_list(ds["values"])]

    if template_name == "horizontal_bar_chart":
        if "values" in props:
            props["values"] = [_ensure_num(v) for v in _ensure_list(props["values"])]

    if template_name == "scatter_plot":
        for group in _ensure_list(props.get("groups")):
            if isinstance(group, dict):
                for pt in _ensure_list(group.get("points")):
                    if isinstance(pt, dict):
                        pt["x"] = _ensure_num(pt.get("x"))
                        pt["y"] = _ensure_num(pt.get("y"))

    if template_name == "heatmap":
        matrix = _ensure_list(props.get("matrix"))
        props["matrix"] = [
            [_ensure_num(cell) for cell in _ensure_list(row)]
            for row in matrix
        ]

    # ── closing_card: paperUrl must be string if present ──
    if template_name == "closing_card":
        if "paperUrl" in props:
            props["paperUrl"] = _ensure_str(props["paperUrl"])

    return props


# ─────────────────────────────────────────────────────────────────────────────
# Remotion rendering
# ─────────────────────────────────────────────────────────────────────────────

def _render_remotion_scene(
    scene,
    index: int,
    output_dir: Path,
    bundle_path: str | None = None,
) -> SceneRenderResult:
    """Render a single scene using Remotion CLI → MP4.

    Only renders the entrance animation frames (per-template setting).
    Assembly extends the last frame with tpad to match TTS audio duration.
    If bundle_path is provided, skips per-render bundling (~40-50s faster).
    """
    t0 = time.monotonic()
    tmpl = get_template(scene.template)

    if not tmpl.has_remotion:
        raise ValueError(
            f"Template '{scene.template}' has no Remotion composition. "
            f"Use HTML renderer for this scene."
        )

    comp_id = tmpl.remotion_comp_id
    anim_frames = tmpl.remotion_anim_frames
    props = adapt_props(scene.template, scene.data)
    props_json = json.dumps(props)

    out_path = output_dir / f"scene_{index:03d}.mp4"

    logger.info("  Scene %d: %s → %s (%d frames / %.1fs)",
                index + 1, scene.template, comp_id, anim_frames, anim_frames / FPS)

    base_cmd = [
        "npx", "remotion", "render",
        *([ bundle_path, comp_id ] if bundle_path else [ comp_id ]),
        str(out_path),
        "--props", props_json,
        "--codec", "h264",
        "--crf", "18",
        "--frames", f"0-{anim_frames - 1}",
        "--scale", "0.667",
    ]
    cmd = base_cmd

    result = subprocess.run(
        cmd,
        cwd=str(REMOTION_DIR),
        capture_output=True,
        text=True,
        timeout=600,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Remotion render failed for scene {index} ({comp_id}):\n"
            f"{result.stderr[:800]}"
        )

    render_time = time.monotonic() - t0
    logger.info("  Scene %d done: %.1fs", index + 1, render_time)

    return SceneRenderResult(
        scene_index=index,
        mode="video",
        video_path=out_path,
        hold_frame_path=None,
        render_time=render_time,
    )


def _render_one(args: tuple) -> SceneRenderResult:
    """Worker function for parallel rendering."""
    scene, index, output_dir, bundle_path = args
    return _render_remotion_scene(scene, index, output_dir, bundle_path)


_bundle_path: str | None = None


def _ensure_bundle() -> str | None:
    """Bundle the Remotion project once and return the bundle directory path.

    Passing the bundle dir to `npx remotion render` skips per-render rebundling,
    saving ~40-50s of startup overhead per scene.
    """
    global _bundle_path
    if _bundle_path and Path(_bundle_path).exists():
        logger.info("  Reusing Remotion bundle: %s", _bundle_path)
        return _bundle_path

    try:
        logger.info("  Bundling Remotion project...")
        t0 = time.monotonic()
        result = subprocess.run(
            ["npx", "remotion", "bundle", "--public-dir", str(REMOTION_DIR / "public")],
            cwd=str(REMOTION_DIR),
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            logger.warning("  ↳ Bundle failed: %s", result.stderr[:300])
            return None

        # Remotion prints the bundle path on the last non-empty line, prefixed with "○ "
        for line in reversed(result.stdout.strip().splitlines()):
            line = line.strip().lstrip("○ ").strip()
            if line and Path(line).is_dir():
                _bundle_path = line
                break

        if not _bundle_path:
            # Default location
            default = REMOTION_DIR / "build"
            if default.is_dir():
                _bundle_path = str(default)

        logger.info("  ↳ Remotion bundle took %.1fs → %s", time.monotonic() - t0, _bundle_path)
        return _bundle_path
    except Exception as e:
        logger.warning("  ↳ Remotion bundle failed (non-fatal): %s", e)
        return None


def render_scenes_remotion(
    scenes: list,
    output_dir: Path,
    on_scene_done: callable = None,
) -> list[SceneRenderResult]:
    """Render all scenes using Remotion, falling back to HTML for unsupported templates.

    Returns list of SceneRenderResult in scene order.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Bundle once, reuse for all scene renders
    bundle_path = _ensure_bundle()

    # Check which scenes have Remotion support
    tasks = []
    for i, scene in enumerate(scenes):
        tmpl = get_template(scene.template)
        if tmpl.has_remotion:
            tasks.append((scene, i, output_dir, bundle_path))
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
        from pipeline.render import render_scenes as render_html

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


class RemotionRenderer:
    """Remotion-based renderer implementing the Renderer protocol."""

    def render(self, scenes, output_dir, on_scene_done=None):
        return render_scenes_remotion(scenes, output_dir, on_scene_done=on_scene_done)
