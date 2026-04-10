import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getJobStatus, type JobStatus } from "./api";

interface ActiveJob {
  jobId: string;
  paperName: string;
  status: JobStatus["status"];
  scenesTotal: number;
  scenesDone: number;
  startedAt: number;
}

interface JobContextValue {
  activeJobs: ActiveJob[];
  addJob: (jobId: string, paperName: string) => void;
  removeJob: (jobId: string) => void;
  /** Most recent job that just finished (cleared after being read) */
  completedJob: ActiveJob | null;
  clearCompleted: () => void;
}

const JobContext = createContext<JobContextValue>({
  activeJobs: [],
  addJob: () => {},
  removeJob: () => {},
  completedJob: null,
  clearCompleted: () => {},
});

export function useJobs() {
  return useContext(JobContext);
}

const STORAGE_KEY = "papervideo_active_jobs";

function loadJobs(): ActiveJob[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveJobs(jobs: ActiveJob[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

export function JobProvider({ children }: { children: React.ReactNode }) {
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>(loadJobs);
  const [completedJob, setCompletedJob] = useState<ActiveJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const addJob = useCallback((jobId: string, paperName: string) => {
    setActiveJobs((prev) => {
      if (prev.some((j) => j.jobId === jobId)) return prev;
      const next = [
        ...prev,
        {
          jobId,
          paperName,
          status: "queued" as const,
          scenesTotal: 0,
          scenesDone: 0,
          startedAt: Date.now(),
        },
      ];
      saveJobs(next);
      return next;
    });
  }, []);

  const removeJob = useCallback((jobId: string) => {
    setActiveJobs((prev) => {
      const next = prev.filter((j) => j.jobId !== jobId);
      saveJobs(next);
      return next;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setCompletedJob(null);
  }, []);

  // Poll active jobs
  useEffect(() => {
    if (activeJobs.length === 0) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      const updates: ActiveJob[] = [];
      let didComplete: ActiveJob | null = null;

      for (const job of activeJobs) {
        if (job.status === "done" || job.status === "failed") {
          // Already terminal — don't re-poll
          continue;
        }
        try {
          const status = await getJobStatus(job.jobId);
          const updated = {
            ...job,
            status: status.status,
            scenesTotal: status.scenes_total,
            scenesDone: status.scenes_done,
          };
          updates.push(updated);

          if (status.status === "done") {
            didComplete = updated;
          }
        } catch {
          updates.push(job); // keep as-is on error
        }
      }

      if (updates.length > 0) {
        setActiveJobs((prev) => {
          const next = prev.map((j) => {
            const update = updates.find((u) => u.jobId === j.jobId);
            return update || j;
          });
          // Remove completed/failed jobs from active list
          const stillActive = next.filter(
            (j) => j.status !== "done" && j.status !== "failed"
          );
          saveJobs(stillActive);
          return stillActive;
        });
      }

      if (didComplete) {
        setCompletedJob(didComplete);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeJobs.length]); // re-setup when job count changes

  return (
    <JobContext.Provider
      value={{ activeJobs, addJob, removeJob, completedJob, clearCompleted }}
    >
      {children}
    </JobContext.Provider>
  );
}
