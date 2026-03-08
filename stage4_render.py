"""Stage 4: Render scenes to frames using Playwright.

Animated templates: capture frame sequences at 30fps using CSS animation-delay stepping.
Static templates: single PNG screenshot.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from pathlib import Path

from playwright.async_api import async_playwright

from template_engine import prepare_scene_html
from template_registry import get_template


FPS = 30
FRAME_INTERVAL_MS = 1000 / FPS  # ~33.33ms


@dataclass
class SceneRenderResult:
    """Result of rendering a single scene."""
    scene_index: int
    mode: str  # "static" or "animated"
    # For static: single PNG path
    static_path: Path | None = None
    # For animated: directory of frame PNGs + count
    frames_dir: Path | None = None
    frame_count: int = 0
    fps: int = FPS
    # Hold frame (last animation frame) for looping remainder
    hold_frame_path: Path | None = None


async def _render_scenes(
    scenes: list, output_dir: Path, preview_only: bool = False
) -> list[SceneRenderResult]:
    """Render all scenes. `scenes` are stage2_planner.Scene objects.

    If preview_only=True, capture a single midpoint screenshot per scene
    instead of full frame sequences.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    results: list[SceneRenderResult] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})

        for i, scene in enumerate(scenes):
            tmpl = get_template(scene.template)
            html = prepare_scene_html(tmpl, scene.data)

            if preview_only:
                mid_ms = tmpl.animation_duration_ms // 2 if tmpl.animated else 0
                result = await _render_preview(page, html, i, mid_ms, output_dir)
            elif tmpl.animated and tmpl.animation_duration_ms > 0:
                result = await _render_animated(
                    page, html, i, tmpl.animation_duration_ms, output_dir
                )
            else:
                result = await _render_static(page, html, i, output_dir)

            results.append(result)

        await browser.close()

    return results


async def _render_static(
    page, html: str, index: int, output_dir: Path
) -> SceneRenderResult:
    """Take a single screenshot for a static template."""
    tmp = output_dir / f"_tmp_scene_{index:03d}.html"
    tmp.write_text(html, encoding="utf-8")

    await page.goto(tmp.as_uri(), wait_until="networkidle")
    await page.wait_for_timeout(2000)  # Wait for Chart.js / KaTeX

    png_path = output_dir / f"scene_{index:03d}.png"
    await page.screenshot(path=str(png_path), full_page=False)
    tmp.unlink(missing_ok=True)

    return SceneRenderResult(
        scene_index=index,
        mode="static",
        static_path=png_path,
        hold_frame_path=png_path,
    )


async def _render_preview(
    page, html: str, index: int, seek_ms: int, output_dir: Path
) -> SceneRenderResult:
    """Single screenshot at a given animation time, for quick preview."""
    tmp = output_dir / f"_tmp_scene_{index:03d}.html"
    tmp.write_text(html, encoding="utf-8")

    await page.goto(tmp.as_uri(), wait_until="networkidle")
    await page.wait_for_timeout(500)

    if seek_ms > 0:
        await page.evaluate(f"""() => {{
            const els = document.querySelectorAll('*');
            for (const el of els) {{
                const style = getComputedStyle(el);
                if (style.animationName && style.animationName !== 'none') {{
                    const origDelay = parseFloat(style.animationDelay) || 0;
                    el.style.animationDelay = (origDelay - {seek_ms}) + 'ms';
                    el.style.animationPlayState = 'paused';
                }}
            }}
        }}""")
        await page.wait_for_timeout(50)

    png_path = output_dir / f"scene_{index:03d}.png"
    await page.screenshot(path=str(png_path), full_page=False)
    tmp.unlink(missing_ok=True)

    return SceneRenderResult(
        scene_index=index,
        mode="static",
        static_path=png_path,
        hold_frame_path=png_path,
    )


async def _render_animated(
    page, html: str, index: int, anim_duration_ms: int, output_dir: Path
) -> SceneRenderResult:
    """Capture animation frames by stepping CSS animation-delay.

    All animations use `animation-play-state: paused`. We set a negative
    animation-delay on every animated element to seek to a specific time,
    then screenshot.
    """
    frames_dir = output_dir / f"scene_{index:03d}_frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    tmp = output_dir / f"_tmp_scene_{index:03d}.html"
    tmp.write_text(html, encoding="utf-8")

    await page.goto(tmp.as_uri(), wait_until="networkidle")
    await page.wait_for_timeout(500)  # Let fonts/KaTeX load

    total_frames = max(1, int(anim_duration_ms / FRAME_INTERVAL_MS))
    frame_paths: list[Path] = []

    for f in range(total_frames):
        time_ms = f * FRAME_INTERVAL_MS

        # Seek all paused animations to `time_ms` via negative delay offset
        await page.evaluate(f"""() => {{
            const els = document.querySelectorAll('*');
            for (const el of els) {{
                const style = getComputedStyle(el);
                if (style.animationName && style.animationName !== 'none') {{
                    // Preserve original delay if set, add our time offset
                    const origDelay = parseFloat(style.animationDelay) || 0;
                    el.style.animationDelay = (origDelay - {time_ms})  + 'ms';
                    el.style.animationPlayState = 'paused';
                }}
            }}
        }}""")

        await page.wait_for_timeout(50)  # Brief settle

        frame_path = frames_dir / f"frame_{f:04d}.png"
        await page.screenshot(path=str(frame_path), full_page=False)
        frame_paths.append(frame_path)

    tmp.unlink(missing_ok=True)

    hold_frame = frame_paths[-1] if frame_paths else None

    return SceneRenderResult(
        scene_index=index,
        mode="animated",
        frames_dir=frames_dir,
        frame_count=len(frame_paths),
        fps=FPS,
        hold_frame_path=hold_frame,
    )


def render_scenes(
    scenes: list, output_dir: Path, preview_only: bool = False
) -> list[SceneRenderResult]:
    """Synchronous wrapper around async renderer."""
    return asyncio.run(_render_scenes(scenes, output_dir, preview_only=preview_only))
