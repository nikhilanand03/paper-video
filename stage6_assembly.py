"""Stage 6: Assemble rendered scenes + MP3s into a final MP4 using ffmpeg.

Handles both static scenes (single PNG) and animated scenes (frame sequences).
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from stage4_render import SceneRenderResult


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
        "-c:v", "libx264", "-tune", "stillimage",
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

    1. Encode frame sequence into a short animation clip.
    2. If audio is longer than animation, append hold frame loop.
    3. Mux audio.
    """
    audio_duration = _get_audio_duration(mp3_path)
    if audio_duration <= 0:
        audio_duration = fallback_duration

    anim_duration = render_result.frame_count / render_result.fps
    clips_to_concat: list[Path] = []
    work_dir = out_path.parent

    # 1) Animated portion from frame sequence
    anim_clip = work_dir / f"_anim_{out_path.stem}.mp4"
    _run([
        "ffmpeg", "-y",
        "-framerate", str(render_result.fps),
        "-i", str(render_result.frames_dir / "frame_%04d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-vf", "fps={fps}".format(fps=render_result.fps),
        str(anim_clip),
    ])
    clips_to_concat.append(anim_clip)

    # 2) Hold frame for remaining duration
    remaining = audio_duration - anim_duration
    if remaining > 0.1 and render_result.hold_frame_path:
        hold_clip = work_dir / f"_hold_{out_path.stem}.mp4"
        _run([
            "ffmpeg", "-y",
            "-loop", "1", "-i", str(render_result.hold_frame_path),
            "-c:v", "libx264", "-tune", "stillimage",
            "-pix_fmt", "yuv420p",
            "-t", str(remaining),
            str(hold_clip),
        ])
        clips_to_concat.append(hold_clip)

    # 3) Concat anim + hold
    if len(clips_to_concat) == 1:
        video_clip = clips_to_concat[0]
    else:
        concat_list = work_dir / f"_concat_{out_path.stem}.txt"
        concat_list.write_text(
            "\n".join(f"file '{p.resolve()}'" for p in clips_to_concat),
            encoding="utf-8",
        )
        video_clip = work_dir / f"_video_{out_path.stem}.mp4"
        _run([
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_list),
            "-c", "copy",
            str(video_clip),
        ])
        concat_list.unlink(missing_ok=True)

    # 4) Mux audio onto video
    _run([
        "ffmpeg", "-y",
        "-i", str(video_clip),
        "-i", str(mp3_path),
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        str(out_path),
    ])

    # Cleanup temp files
    for clip in clips_to_concat:
        clip.unlink(missing_ok=True)
    video_path = work_dir / f"_video_{out_path.stem}.mp4"
    video_path.unlink(missing_ok=True)

    return out_path


def concatenate_clips(clip_paths: list[Path], output_path: Path) -> Path:
    """Concatenate scene clips into a single MP4."""
    list_file = output_path.parent / "concat_list.txt"
    list_file.write_text(
        "\n".join(f"file '{p.resolve()}'" for p in clip_paths),
        encoding="utf-8",
    )

    _run([
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(list_file),
        "-c", "copy",
        str(output_path),
    ])
    list_file.unlink(missing_ok=True)
    return output_path


def assemble(
    render_results: list[SceneRenderResult],
    mp3_paths: list[Path],
    output_dir: Path,
) -> Path:
    """Full assembly: render results + audio → final MP4."""
    clips_dir = output_dir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    clip_paths: list[Path] = []
    for i, (result, mp3) in enumerate(zip(render_results, mp3_paths)):
        clip = clips_dir / f"clip_{i:03d}.mp4"

        if result.mode == "animated" and result.frames_dir:
            _make_animated_clip(result, mp3, clip)
        else:
            # Static or fallback
            png = result.static_path or result.hold_frame_path
            if png is None:
                raise RuntimeError(f"Scene {i} has no renderable frame")
            _make_static_clip(png, mp3, clip)

        clip_paths.append(clip)

    final = output_dir / "final.mp4"
    concatenate_clips(clip_paths, final)
    return final
