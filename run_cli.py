#!/usr/bin/env python3
"""CLI to run the paper-to-video pipeline on a local PDF.

Usage:
    python run_cli.py sample-pdfs/my_paper.pdf
    python run_cli.py sample-pdfs/my_paper.pdf --frames-only
    python run_cli.py /absolute/path/to/paper.pdf
"""

import sys
from pathlib import Path

from tqdm import tqdm

from pipeline import (
    create_job, get_job, run_pipeline,
    PIPELINE_STAGES_FULL, PIPELINE_STAGES_FRAMES_ONLY,
)

## python run_cli.py sample-pdfs/immunostruct.pdf
## python run_cli.py sample-pdfs/immunostruct.pdf --frames-only


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    frames_only = "--frames-only" in flags

    if not args:
        print("Usage: python run_cli.py <path-to-pdf> [--frames-only]")
        sys.exit(1)

    pdf_path = Path(args[0]).resolve()
    if not pdf_path.exists():
        print(f"File not found: {pdf_path}")
        sys.exit(1)
    if not pdf_path.suffix.lower() == ".pdf":
        print("Please provide a PDF file.")
        sys.exit(1)

    job_id = create_job(pdf_path, frames_only=frames_only)
    job = get_job(job_id)
    print(f"Job created: {job_id}")
    print(f"Output dir:  {job['job_dir']}")
    if frames_only:
        print("Mode:        frames-only (no TTS/assembly)")
    print()

    stages = PIPELINE_STAGES_FRAMES_ONLY if frames_only else PIPELINE_STAGES_FULL
    stage_index = {s: i for i, s in enumerate(stages)}
    pbar = tqdm(total=len(stages), bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]")

    def on_stage(status, label):
        pbar.set_description(label)
        pbar.n = stage_index.get(status, pbar.n) + 1
        pbar.refresh()

    run_pipeline(job_id, on_stage=on_stage, frames_only=frames_only)
    pbar.close()

    job = get_job(job_id)
    if job["status"] == "done":
        if frames_only:
            preview_dir = Path(job["job_dir"]) / "preview"
            frame_count = len(list(preview_dir.glob("*.png")))
            print(f"\nDone! {frame_count} preview frames in: {preview_dir}")
        else:
            print(f"\nDone! Video: {job['final_path']}")
    else:
        print(f"\nFailed: {job['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
