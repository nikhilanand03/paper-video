"""FastAPI app — upload PDF, track progress, download result."""

from __future__ import annotations

import shutil
import threading
from pathlib import Path

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pipeline import create_job, get_job, run_pipeline, OUTPUT_ROOT

app = FastAPI(title="Paper-to-Video")


@app.post("/upload")
async def upload_pdf(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file.")

    # Save uploaded PDF
    job_id = create_job(Path("pending"))  # placeholder, will overwrite path
    job_dir = OUTPUT_ROOT / job_id
    pdf_path = job_dir / file.filename
    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Update job with real path
    job = get_job(job_id)
    job["pdf_path"] = str(pdf_path)

    # Run pipeline in background thread
    t = threading.Thread(target=run_pipeline, args=(job_id,), daemon=True)
    t.start()

    return {"job_id": job_id}


@app.get("/status/{job_id}")
async def job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return {
        "status": job["status"],
        "error": job["error"],
        "scenes_total": job["scenes_total"],
        "scenes_done": job["scenes_done"],
    }


@app.get("/download/{job_id}")
async def download_video(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    if job["status"] != "done":
        raise HTTPException(409, f"Job is not done yet (status: {job['status']}).")
    final = Path(job["final_path"])
    if not final.exists():
        raise HTTPException(500, "Output file missing.")
    return FileResponse(final, media_type="video/mp4", filename="paper_video.mp4")


# Serve frontend
app.mount("/", StaticFiles(directory="static", html=True), name="static")
