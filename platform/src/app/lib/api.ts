/**
 * API client for the FastAPI backend (app.py).
 *
 * In dev, Vite proxies /upload, /status, /job, /stream, /download to localhost:8000.
 * In production, set VITE_API_URL to the backend URL (e.g. https://your-backend.azurewebsites.net).
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface JobStatus {
  status:
    | "queued"
    | "extracting"
    | "planning"
    | "rendering"
    | "synthesizing_tts"
    | "assembling"
    | "done"
    | "failed";
  error: string | null;
  scenes_total: number;
  scenes_done: number;
}

export interface JobData {
  paper?: {
    title?: string;
    authors?: string[];
    venue?: string;
    year?: number;
    abstract?: string;
    sections?: { heading: string; text?: string; body?: string }[];
    tables?: any[];
    figures?: any[];
  };
  plan?: {
    scenes: {
      scene_number: number;
      template: string;
      data: Record<string, any>;
      narration: string;
      duration_seconds: number;
    }[];
  };
}

/** Upload a PDF and start the pipeline. Returns the job ID. */
export async function uploadPdf(file: File, mode: "brief" | "detailed" = "brief"): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload?mode=${mode}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }

  const data = await res.json();
  return data.job_id;
}

/** Poll job status. */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/status/${jobId}`);
  if (!res.ok) throw new Error("Failed to get job status");
  return res.json();
}

/** Fetch extraction + plan data for a completed job. */
export async function getJobData(jobId: string): Promise<JobData> {
  const res = await fetch(`${API_BASE}/job/${jobId}/data`);
  if (!res.ok) throw new Error("Failed to get job data");
  return res.json();
}

/** Get the streaming URL for in-browser video playback. */
export function getStreamUrl(jobId: string): string {
  return `${API_BASE}/stream/${jobId}`;
}

/** Get the download URL for a completed video. */
export function getDownloadUrl(jobId: string): string {
  return `${API_BASE}/download/${jobId}`;
}

/** Fetch real scene chapter timestamps for a job. */
export async function getChapters(
  jobId: string
): Promise<{ start: number; duration: number }[] | null> {
  try {
    const res = await fetch(`${API_BASE}/chapters/${jobId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Check if the backend is reachable. */
export async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/templates`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Map pipeline status to stage index (0-4) for the progress stepper. */
export function statusToStageIndex(status: JobStatus["status"]): number {
  switch (status) {
    case "queued":
    case "extracting":
      return 0;
    case "planning":
      return 1;
    case "rendering":
      return 2;
    case "synthesizing_tts":
      return 3;
    case "assembling":
      return 4;
    case "done":
      return 5;
    case "failed":
      return -1;
    default:
      return 0;
  }
}
