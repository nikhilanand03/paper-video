import { useNavigate, useLocation } from "react-router";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { useJobs } from "../lib/JobContext";
import { statusToStageIndex } from "../lib/api";

const STAGE_LABELS = ["Extracting", "Planning", "Rendering", "TTS", "Assembling"];

export default function JobBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeJobs, completedJob, clearCompleted } = useJobs();

  // Don't show banner if user is already on the processing page for this job
  const currentJobId = location.pathname.match(/^\/video\/(.+)/)?.[1];

  const visibleJobs = activeJobs.filter((j) => j.jobId !== currentJobId);
  const showCompleted = completedJob && completedJob.jobId !== currentJobId;

  if (visibleJobs.length === 0 && !showCompleted) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Completed notification */}
      {showCompleted && (
        <div
          onClick={() => {
            navigate(`/v/${completedJob.jobId}`);
            clearCompleted();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            backgroundColor: "#FFFFFF",
            border: "1px solid #DCFCE7",
            borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            cursor: "pointer",
            maxWidth: 340,
          }}
        >
          <CheckCircle2 size={18} color="#16A34A" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: "#1A1A1A",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Video ready
            </div>
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                color: "#6B7280",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {completedJob.paperName} — click to view
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearCompleted();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              color: "#9CA3AF",
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Active processing jobs */}
      {visibleJobs.map((job) => {
        const stageIdx = statusToStageIndex(job.status);
        const stageLabel =
          stageIdx >= 0 && stageIdx < STAGE_LABELS.length
            ? STAGE_LABELS[stageIdx]
            : "Processing";
        const sceneInfo =
          job.status === "rendering" && job.scenesTotal > 0
            ? ` (${job.scenesDone}/${job.scenesTotal})`
            : "";

        return (
          <div
            key={job.jobId}
            onClick={() => navigate(`/video/${job.jobId}`)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              cursor: "pointer",
              maxWidth: 340,
            }}
          >
            <Loader2
              size={16}
              color="#2563EB"
              className="animate-spin"
              style={{ flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#1A1A1A",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {stageLabel}
                {sceneInfo}
              </div>
              <div
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 12,
                  color: "#9CA3AF",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {job.paperName}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
