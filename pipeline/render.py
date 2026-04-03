"""Render scenes to frames using Playwright.

Animated templates: capture frame sequences at 30fps using Web Animations API.
Static templates: single PNG screenshot.
Scenes are rendered in parallel using multiple browser pages.
"""

from __future__ import annotations

import asyncio
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from playwright.async_api import async_playwright

from pipeline.template_engine import prepare_scene_html
from pipeline.template_registry import get_template


class Renderer(Protocol):
    """Interface that all renderers implement."""

    def render(
        self,
        scenes: list,
        output_dir: Path,
        on_scene_done: callable = None,
    ) -> list[SceneRenderResult]: ...


FPS = 30
FRAME_INTERVAL_MS = 1000 / FPS  # ~33.33ms
MAX_CONCURRENT = int(os.environ.get("RENDER_CONCURRENCY", "4"))


@dataclass
class SceneRenderResult:
    """Result of rendering a single scene."""
    scene_index: int
    mode: str  # "static", "animated", or "video"
    # For static: single PNG path
    static_path: Path | None = None
    # For animated: directory of frame PNGs + count
    frames_dir: Path | None = None
    frame_count: int = 0
    fps: int = FPS
    # Hold frame (last animation frame) for looping remainder
    hold_frame_path: Path | None = None
    # For video (Remotion): pre-rendered MP4 path
    video_path: Path | None = None
    # Timing
    render_time: float = 0.0


async def _render_single_scene(
    browser, scene, index: int, output_dir: Path, preview_only: bool,
) -> SceneRenderResult:
    """Render a single scene using a dedicated browser page."""
    t0 = time.monotonic()
    page = await browser.new_page(viewport={"width": 1920, "height": 1080})
    try:
        tmpl = get_template(scene.template)
        html = prepare_scene_html(tmpl, scene.data)

        if preview_only:
            mid_ms = tmpl.animation_duration_ms // 2 if tmpl.animated else 0
            result = await _render_preview(page, html, index, mid_ms, output_dir)
        elif tmpl.animated and tmpl.animation_duration_ms > 0:
            result = await _render_animated(
                page, html, index, tmpl.animation_duration_ms, output_dir
            )
        else:
            result = await _render_static(page, html, index, output_dir)

        result.render_time = time.monotonic() - t0
        return result
    finally:
        await page.close()


async def _render_scenes(
    scenes: list, output_dir: Path, preview_only: bool = False,
    on_scene_done: callable = None,
) -> list[SceneRenderResult]:
    """Render all scenes in parallel with bounded concurrency."""
    output_dir.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    completed_count = 0
    lock = asyncio.Lock()

    async def _render_with_semaphore(scene, index):
        nonlocal completed_count
        async with semaphore:
            result = await _render_single_scene(
                browser, scene, index, output_dir, preview_only
            )
            async with lock:
                completed_count += 1
                if on_scene_done:
                    on_scene_done(completed_count)
            return result

    async with async_playwright() as p:
        browser = await p.chromium.launch()

        tasks = [
            _render_with_semaphore(scene, i)
            for i, scene in enumerate(scenes)
        ]
        results = await asyncio.gather(*tasks)

        await browser.close()

    # Results are already in order (asyncio.gather preserves task order)
    return list(results)


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
            for (const anim of document.getAnimations()) {{
                anim.pause();
                anim.currentTime = {seek_ms};
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
    """Capture animation frames by stepping through Web Animations API."""
    frames_dir = output_dir / f"scene_{index:03d}_frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    tmp = output_dir / f"_tmp_scene_{index:03d}.html"
    tmp.write_text(html, encoding="utf-8")

    await page.goto(tmp.as_uri(), wait_until="networkidle")
    await page.wait_for_timeout(500)  # Let fonts/KaTeX load

    # Pause all animations immediately via Web Animations API
    await page.evaluate("""() => {
        for (const anim of document.getAnimations()) {
            anim.pause();
        }
    }""")

    total_frames = max(1, int(anim_duration_ms / FRAME_INTERVAL_MS))
    frame_paths: list[Path] = []

    for f in range(total_frames):
        time_ms = f * FRAME_INTERVAL_MS

        # Seek all animations to the target time using Web Animations API
        await page.evaluate(f"""() => {{
            for (const anim of document.getAnimations()) {{
                anim.currentTime = {time_ms};
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
    scenes: list, output_dir: Path, preview_only: bool = False,
    on_scene_done: callable = None,
) -> list[SceneRenderResult]:
    """Synchronous wrapper around async renderer."""
    return asyncio.run(_render_scenes(
        scenes, output_dir, preview_only=preview_only,
        on_scene_done=on_scene_done,
    ))


class HtmlRenderer:
    """Playwright-based HTML renderer implementing the Renderer protocol."""

    def render(self, scenes, output_dir, on_scene_done=None):
        return render_scenes(scenes, output_dir, on_scene_done=on_scene_done)

    def render_preview(self, scenes, output_dir, on_scene_done=None):
        return render_scenes(scenes, output_dir, preview_only=True, on_scene_done=on_scene_done)
