"""Stage 6: Assemble rendered scenes + MP3s into a final MP4 using ffmpeg.

Handles both static scenes (single PNG) and animated scenes (frame sequences).
Scene clips are assembled in parallel for speed.
"""

from __future__ import annotations

import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from stage4_render import SceneRenderResult

MAX_ASSEMBLY_WORKERS = int(os.environ.get("ASSEMBLY_CONCURRENCY", "4"))


def _run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[:500]}")


def _get_audio_duration(mp3_path: Path) -> float:
    """Get duration of an audio file in seconds via ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(mp3_path),
        ],
        capture_output=True, text=True,
    )
    return float(result.stdout.strip())


def _make_static_clip(
    png_path: Path, mp3_path: Path, out_path: Path, fallback_duration: float = 8.0
) -> Path:
    """Create a video clip: still image held for audio duration + audio track."""
    duration = _get_audio_duration(mp3_path)
    if duration <= 0:
        duration = fallback_duration

    _run([
        "ffmpeg", "-y",
        "-loop", "1", "-i", str(png_path),
        "-i", str(mp3_path),
        "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-t", str(duration),
        str(out_path),
    ])
    return out_path


def _make_animated_clip(
    render_result: SceneRenderResult, mp3_path: Path, out_path: Path,
    fallback_duration: float = 8.0
) -> Path:
    """Create clip from animation frame sequence + hold frame for remaining duration.

    Two ffmpeg calls: (1) encode anim + hold into one video, (2) mux audio.
    """
    audio_duration = _get_audio_duration(mp3_path)
    if audio_duration <= 0:
        audio_duration = fallback_duration

    anim_duration = render_result.frame_count / render_result.fps
    remaining = audio_duration - anim_duration
    fps = render_result.fps
    work_dir = out_path.parent

    # Step 1: Build the video track (anim frames + hold frame) in one encode
    video_clip = work_dir / f"_video_{out_path.stem}.mp4"

    # Encode anim frames + hold image as a single video using tpad to freeze
    # the last frame for the remaining duration — one ffmpeg call, no concat.
    if remaining > 0.1:
        _run([
            "ffmpeg", "-y",
            "-framerate", str(fps),
            "-i", str(render_result.frames_dir / "frame_%04d.png"),
            "-vf", f"fps={fps},tpad=stop_mode=clone:stop_duration={remaining}",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            str(video_clip),
        ])
    else:
        _run([
            "ffmpeg", "-y",
            "-framerate", str(fps),
            "-i", str(render_result.frames_dir / "frame_%04d.png"),
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-vf", f"fps={fps}",
            str(video_clip),
        ])

    # Step 2: Mux audio (explicit mapping to always use TTS audio)
    _run([
        "ffmpeg", "-y",
        "-i", str(video_clip),
        "-i", str(mp3_path),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        str(out_path),
    ])
    video_clip.unlink(missing_ok=True)

    return out_path


def _make_video_clip(
    video_path: Path, mp3_path: Path, out_path: Path,
    fallback_duration: float = 8.0
) -> Path:
    """Create clip from pre-rendered video (Remotion) + audio overlay.

    If the audio is longer than the video, the last frame is held via tpad.
    """
    audio_duration = _get_audio_duration(mp3_path)
    if audio_duration <= 0:
        audio_duration = fallback_duration

    # Get video duration
    result = subprocess.run(
        [
            "ffprobe", "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        capture_output=True, text=True,
    )
    video_duration = float(result.stdout.strip()) if result.stdout.strip() else 0

    remaining = audio_duration - video_duration
    work_dir = out_path.parent

    if remaining > 0.1:
        # Extend video with tpad, then mux audio
        extended = work_dir / f"_extended_{out_path.stem}.mp4"
        _run([
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-vf", f"tpad=stop_mode=clone:stop_duration={remaining}",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-an",
            str(extended),
        ])
        _run([
            "ffmpeg", "-y",
            "-i", str(extended),
            "-i", str(mp3_path),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            str(out_path),
        ])
        extended.unlink(missing_ok=True)
    else:
        # Video is long enough — just mux audio (trim video to audio length)
        _run([
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-i", str(mp3_path),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-t", str(audio_duration),
            str(out_path),
        ])

    return out_path


def _assemble_one(args: tuple) -> Path:
    """Assemble a single scene clip (for parallel execution)."""
    i, result, mp3, clips_dir = args
    clip = clips_dir / f"clip_{i:03d}.mp4"
    if result.mode == "video" and result.video_path:
        _make_video_clip(result.video_path, mp3, clip)
    elif result.mode == "animated" and result.frames_dir:
        _make_animated_clip(result, mp3, clip)
    else:
        png = result.static_path or result.hold_frame_path
        if png is None:
            raise RuntimeError(f"Scene {i} has no renderable frame")
        _make_static_clip(png, mp3, clip)
    return clip


def concatenate_clips(clip_paths: list[Path], output_path: Path) -> Path:
    """Concatenate scene clips into a single MP4.

    Uses the concat *filter* (not demuxer) to properly align audio/video
    timestamps. Batches in groups to avoid hitting shell arg limits.
    """
    BATCH = 20  # concat filter limit per pass

    if len(clip_paths) <= BATCH:
        return _concat_filter(clip_paths, output_path)

    # Multi-pass: concat in batches, then concat the intermediates
    work_dir = output_path.parent
    intermediates: list[Path] = []
    for batch_idx in range(0, len(clip_paths), BATCH):
        batch = clip_paths[batch_idx : batch_idx + BATCH]
        tmp = work_dir / f"_concat_batch_{batch_idx // BATCH}.mp4"
        _concat_filter(batch, tmp)
        intermediates.append(tmp)

    _concat_filter(intermediates, output_path)
    for tmp in intermediates:
        tmp.unlink(missing_ok=True)
    return output_path


def _concat_filter(clip_paths: list[Path], output_path: Path) -> Path:
    """Concat a list of clips using the ffmpeg concat filter."""
    n = len(clip_paths)
    inputs: list[str] = []
    for p in clip_paths:
        inputs += ["-i", str(p)]

    filter_parts = "".join(f"[{i}:v:0][{i}:a:0]" for i in range(n))
    filter_str = f"{filter_parts}concat=n={n}:v=1:a=1[outv][outa]"

    _run([
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_str,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        str(output_path),
    ])
    return output_path


def assemble(
    render_results: list[SceneRenderResult],
    mp3_paths: list[Path],
    output_dir: Path,
) -> Path:
    """Full assembly: render results + audio → final MP4.

    Scene clips are assembled in parallel using a thread pool.
    """
    clips_dir = output_dir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    tasks = [
        (i, result, mp3, clips_dir)
        for i, (result, mp3) in enumerate(zip(render_results, mp3_paths))
    ]

    with ThreadPoolExecutor(max_workers=MAX_ASSEMBLY_WORKERS) as pool:
        clip_paths = list(pool.map(_assemble_one, tasks))

    # Sort by index to maintain order
    clip_paths.sort(key=lambda p: p.name)

    # Build chapters.json with actual per-clip durations
    chapters = []
    offset = 0.0
    for clip in clip_paths:
        dur = _get_audio_duration(clip)  # works for video files too via ffprobe
        chapters.append({"start": round(offset, 3), "duration": round(dur, 3)})
        offset += dur
    (output_dir / "chapters.json").write_text(json.dumps(chapters, indent=2))

    final = output_dir / "final.mp4"
    concatenate_clips(clip_paths, final)
    return final
