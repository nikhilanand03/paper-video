#!/usr/bin/env python3
"""CLI to run the paper-to-video pipeline on a local PDF.

Usage:
    python run_cli.py sample-pdfs/my_paper.pdf
    python run_cli.py sample-pdfs/my_paper.pdf --frames-only
    python run_cli.py sample-pdfs/my_paper.pdf --till-extract
    python run_cli.py sample-pdfs/my_paper.pdf --till-plan
    python run_cli.py sample-pdfs/my_paper.pdf --till-render
    python run_cli.py sample-pdfs/my_paper.pdf --till-tts
"""

import argparse
import sys
from pathlib import Path

from tqdm import tqdm

from pipeline import (
    create_job, get_job, run_pipeline,
    PIPELINE_STAGES_FULL, PIPELINE_STAGES_FRAMES_ONLY,
    Status,
)

# Maps --till-* flags to (till_stage value, suffix, stage list)
_TILL_MAP = {
    "extract": ("extract", "_te", [Status.EXTRACTING, Status.DONE]),
    "plan":    ("plan",    "_tp", [Status.EXTRACTING, Status.PLANNING, Status.DONE]),
    "render":  ("render",  "_tr", [Status.EXTRACTING, Status.PLANNING, Status.RENDERING, Status.DONE]),
    "tts":     ("tts",     "_tt", [Status.EXTRACTING, Status.PLANNING, Status.RENDERING, Status.SYNTHESIZING_TTS, Status.DONE]),
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Paper-to-video pipeline CLI")
    parser.add_argument("pdf", help="Path to the PDF file")
    parser.add_argument("--frames-only", action="store_true", help="Stop after rendering frames (no TTS/assembly)")
    parser.add_argument("--till-extract", action="store_true", help="Run only extraction (suffix: _te)")
    parser.add_argument("--till-plan", action="store_true", help="Run up to planning (suffix: _tp)")
    parser.add_argument("--till-render", action="store_true", help="Run up to rendering (suffix: _tr)")
    parser.add_argument("--till-tts", action="store_true", help="Run up to TTS (suffix: _tt)")
    args = parser.parse_args()

    pdf_path = Path(args.pdf).resolve()
    if not pdf_path.exists():
        print(f"File not found: {pdf_path}")
        sys.exit(1)
    if pdf_path.suffix.lower() != ".pdf":
        print("Please provide a PDF file.")
        sys.exit(1)

    # Determine which till-* flag is active (last one wins if multiple)
    till_stage = None
    suffix = ""
    stages = None
    for flag_name, (stage_val, sfx, stage_list) in _TILL_MAP.items():
        if getattr(args, f"till_{flag_name}"):
            till_stage = stage_val
            suffix = sfx
            stages = stage_list

    frames_only = args.frames_only
    if not till_stage:
        if frames_only:
            suffix = "_fo"
            stages = PIPELINE_STAGES_FRAMES_ONLY
        else:
            stages = PIPELINE_STAGES_FULL

    job_id = create_job(pdf_path, frames_only=frames_only, suffix=suffix)
    job = get_job(job_id)
    print(f"Job created: {job_id}")
    print(f"Output dir:  {job['job_dir']}")
    if till_stage:
        print(f"Mode:        till-{till_stage} (suffix: {suffix})")
    elif frames_only:
        print("Mode:        frames-only (no TTS/assembly)")
    print()

    stage_index = {s: i for i, s in enumerate(stages)}
    pbar = tqdm(total=len(stages), bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]")

    def on_stage(status, label):
        pbar.set_description(label)
        pbar.n = stage_index.get(status, pbar.n) + 1
        pbar.refresh()

    run_pipeline(job_id, on_stage=on_stage, frames_only=frames_only, till_stage=till_stage)
    pbar.close()

    job = get_job(job_id)
    if job["status"] == "done":
        job_dir = Path(job["job_dir"])
        if till_stage == "extract":
            print(f"\nDone! Extraction saved to: {job_dir}")
            print(f"  text.json, figures/, figures.json, tables/, tables.json")
        elif till_stage == "plan":
            print(f"\nDone! Plan saved to: {job_dir / 'plan.json'}")
        elif till_stage == "render":
            preview_dir = job_dir / "preview"
            frame_count = len(list(preview_dir.glob("*.png"))) if preview_dir.exists() else 0
            print(f"\nDone! {frame_count} preview frames in: {preview_dir}")
        elif till_stage == "tts":
            audio_dir = job_dir / "audio"
            audio_count = len(list(audio_dir.glob("*.mp3"))) if audio_dir.exists() else 0
            print(f"\nDone! {audio_count} audio files in: {audio_dir}")
        elif frames_only:
            preview_dir = job_dir / "preview"
            frame_count = len(list(preview_dir.glob("*.png")))
            print(f"\nDone! {frame_count} preview frames in: {preview_dir}")
        else:
            print(f"\nDone! Video: {job['final_path']}")
    else:
        print(f"\nFailed: {job['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
