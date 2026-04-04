import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  mockPaperData,
  processingStages,
  saveVideoToLibrary,
  templateInfo,
} from "../lib/data";
import { getJobStatus, getJobData, statusToStageIndex } from "../lib/api";
import { useAuth } from "../lib/useAuth";
import UserMenu from "../components/UserMenu";

// Generates a plausible scene plan from section titles
function generateScenePlan(sections: { id: string; title: string }[]) {
  const scenes: any[] = [];
  let id = 1;

  scenes.push({ id: id++, type: "title_card", label: "Title", duration: 8 });
  scenes.push({
    id: id++,
    type: "quote_highlight",
    label: "Key Claim",
    duration: 10,
  });

  for (const section of sections) {
    scenes.push({
      id: id++,
      type: "section_header",
      label: section.title,
      duration: 4,
    });

    const lower = section.title.toLowerCase();
    if (lower.includes("intro") || lower.includes("background")) {
      scenes.push({
        id: id++,
        type: "flashcard_list",
        label: "Key Points",
        duration: 12,
      });
    } else if (
      lower.includes("method") ||
      lower.includes("approach") ||
      lower.includes("model")
    ) {
      scenes.push({
        id: id++,
        type: "image_with_caption",
        label: "Architecture",
        duration: 15,
      });
      scenes.push({
        id: id++,
        type: "flashcard_list",
        label: "Method Steps",
        duration: 12,
      });
    } else if (lower.includes("result") || lower.includes("experiment")) {
      scenes.push({
        id: id++,
        type: "data_table",
        label: "Results Table",
        duration: 15,
      });
      scenes.push({
        id: id++,
        type: "multi_metric_cards",
        label: "Key Metrics",
        duration: 10,
      });
      scenes.push({
        id: id++,
        type: "bar_chart",
        label: "Performance Chart",
        duration: 12,
      });
    } else if (lower.includes("compar") || lower.includes("related")) {
      scenes.push({
        id: id++,
        type: "comparison_split",
        label: "Comparison",
        duration: 12,
      });
    } else if (lower.includes("ablation") || lower.includes("analysis")) {
      scenes.push({
        id: id++,
        type: "grouped_bar_chart",
        label: "Ablation Results",
        duration: 12,
      });
    } else if (lower.includes("conclu") || lower.includes("summary")) {
      scenes.push({
        id: id++,
        type: "big_number",
        label: "Standout Result",
        duration: 10,
      });
    } else {
      scenes.push({
        id: id++,
        type: "flashcard_list",
        label: "Key Points",
        duration: 12,
      });
    }
  }

  scenes.push({
    id: id++,
    type: "closing_card",
    label: "Takeaway",
    duration: 8,
  });
  return scenes;
}

function simulateExtraction(name: string, url: string) {
  let title = "Uploaded Paper";
  if (name) {
    title = name
      .replace(/\.pdf$/i, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } else if (url) {
    const arxivMatch = url.match(/(\d{4}\.\d{4,5})/);
    title = arxivMatch ? `arXiv Paper ${arxivMatch[1]}` : "Paper from URL";
  }

  return {
    title,
    authors: ["Author A", "Author B", "Author C", "et al."],
    venue: "Conference 2024",
    year: 2024,
    url: url || undefined,
    abstract:
      "Analyzing paper content and extracting key information including text, figures, tables, and equations for video generation...",
    sections: [
      { id: "intro", title: "Introduction", content: "", heading: "Introduction", body: "" },
      { id: "method", title: "Methodology", content: "", heading: "Methodology", body: "" },
      { id: "results", title: "Results", content: "", heading: "Results", body: "" },
      { id: "discussion", title: "Discussion", content: "", heading: "Discussion", body: "" },
      { id: "conclusion", title: "Conclusion", content: "", heading: "Conclusion", body: "" },
    ],
  };
}

export default function Processing() {
  const navigate = useNavigate();
  const { user, signInWithGoogle, signOut } = useAuth();
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();

  const paperId = searchParams.get("paperId");
  const source = searchParams.get("source");
  const uploadName = searchParams.get("name") || "";
  const uploadUrl = searchParams.get("url") || "";
  const isDemo = searchParams.get("demo") === "1";
  const isExample = !!paperId && !!mockPaperData[paperId];

  const [currentStage, setCurrentStage] = useState(0);
  const [scenePlan, setScenePlan] = useState<any[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completedTime, setCompletedTime] = useState<number | null>(null);
  const [paperInfo, setPaperInfo] = useState<any>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [scenesDone, setScenesDone] = useState(0);
  const [scenesTotal, setScenesTotal] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const elapsedTimeRef = useRef(0);
  const pollFailCountRef = useRef(0);
  const paperInfoFetchedRef = useRef(false);
  const scenePlanFetchedRef = useRef(false);

  const knownPaper = isExample ? mockPaperData[paperId!] : null;

  // ── Real backend polling (non-demo, non-example uploads) ──
  const useRealBackend = !isDemo && !isExample && !!jobId;

  useEffect(() => {
    if (!useRealBackend) return;

    const poll = async () => {
      try {
        const status = await getJobStatus(jobId!);
        pollFailCountRef.current = 0;
        const stageIdx = statusToStageIndex(status.status);
        setCurrentStage(stageIdx);
        setScenesTotal(status.scenes_total);
        setScenesDone(status.scenes_done);

        // After extraction, fetch real paper info (once)
        if (stageIdx >= 1 && !paperInfoFetchedRef.current) {
          paperInfoFetchedRef.current = true;
          try {
            const data = await getJobData(jobId!);
            if (data.paper) {
              const sections = data.paper.sections || [];
              const abstractSection = sections.find((s: any) => s.heading?.toLowerCase() === "abstract");
              setPaperInfo({
                title: data.paper.title || uploadName.replace(/\.pdf$/i, ""),
                authors: data.paper.authors || [],
                venue: data.paper.venue || "",
                year: data.paper.year || new Date().getFullYear(),
                abstract: data.paper.abstract || abstractSection?.body || "",
                sections: sections
                  .filter((s: any) => s.heading?.toLowerCase() !== "abstract")
                  .map((s: any) => ({
                    id: s.heading?.toLowerCase().replace(/\s+/g, "-") || "section",
                    title: s.heading || "Section",
                    content: s.body || s.text || "",
                  })),
              });
            }
          } catch {
            // No fake data — just leave paperInfo as null (shows skeleton)
          }
        }

        // After planning, fetch real scene plan (once)
        if (stageIdx >= 2 && !scenePlanFetchedRef.current) {
          scenePlanFetchedRef.current = true;
          try {
            const data = await getJobData(jobId!);
            if (data.plan?.scenes) {
              setScenePlan(
                data.plan.scenes.map((s: any) => ({
                  id: s.scene_number,
                  type: s.template,
                  label: s.data?.title || s.data?.heading || s.template.replace(/_/g, " "),
                  duration: s.duration_seconds,
                  narration: s.narration,
                  sectionId: null,
                }))
              );
            }
          } catch {
            // No fake scenes — just leave scenePlan empty
          }
        }

        // Done → fetch full data and navigate to viewer
        if (status.status === "done") {
          clearInterval(pollingRef.current);
          try {
            const data = await getJobData(jobId!);
            const paper = data.paper || {};
            const allSections = paper.sections || [];
            const abstractSection = allSections.find((s: any) => s.heading?.toLowerCase() === "abstract");
            const scenes = (data.plan?.scenes || []).map((s: any) => ({
              id: s.scene_number,
              type: s.template,
              label: s.data?.title || s.data?.heading || s.template.replace(/_/g, " "),
              duration: s.duration_seconds,
              narration: s.narration,
              data: s.data,
            }));
            const totalDuration = scenes.reduce((sum: number, s: any) => sum + s.duration, 0);
            saveVideoToLibrary(jobId!, {
              title: paper.title || uploadName.replace(/\.pdf$/i, ""),
              authors: paper.authors || [],
              venue: paper.venue || "",
              year: paper.year || new Date().getFullYear(),
              url: uploadUrl || undefined,
              abstract: paper.abstract || abstractSection?.body || "",
              sections: allSections
                .filter((s: any) => s.heading?.toLowerCase() !== "abstract")
                .map((s: any) => ({
                  id: s.heading?.toLowerCase().replace(/\s+/g, "-") || "section",
                  title: s.heading || "Section",
                  content: s.body || s.text || "",
                })),
              scenes,
              duration: totalDuration || 120,
              realJobId: jobId,
            });
          } catch {
            // Minimal fallback — only use filename, no fake authors/sections
            saveVideoToLibrary(jobId!, {
              title: uploadName.replace(/\.pdf$/i, "") || "Uploaded Paper",
              authors: [],
              venue: "",
              year: new Date().getFullYear(),
              scenes: scenePlan,
              duration: 120,
              realJobId: jobId,
            });
          }
          setCompletedTime(elapsedTimeRef.current);
          setTimeout(() => navigate(`/v/${jobId}`), 2000);
        }

        // Failed
        if (status.status === "failed") {
          clearInterval(pollingRef.current);
          setPipelineError(
            status.error || "Something went wrong while generating your video."
          );
        }
      } catch {
        pollFailCountRef.current += 1;
        if (pollFailCountRef.current >= 15) {
          clearInterval(pollingRef.current);
          setPipelineError(
            "Lost connection to the pipeline. The job may have been interrupted by a server restart. Please try again."
          );
        }
      }
    };

    // Poll immediately, then every 2s
    poll();
    pollingRef.current = setInterval(poll, 2000);

    return () => clearInterval(pollingRef.current);
  }, [useRealBackend, jobId]);

  // ── Demo / example mode (simulated timers) ──
  useEffect(() => {
    if (useRealBackend) return;

    const stageTimers: ReturnType<typeof setTimeout>[] = [];

    stageTimers.push(
      setTimeout(() => {
        setCurrentStage(1);
        if (!isExample) {
          setPaperInfo(simulateExtraction(uploadName, uploadUrl));
        }
      }, 5000)
    );

    stageTimers.push(
      setTimeout(() => {
        setCurrentStage(2);
        if (isExample) {
          setScenePlan(knownPaper.scenes || []);
        } else {
          const info = simulateExtraction(uploadName, uploadUrl);
          setScenePlan(generateScenePlan(info.sections));
        }
      }, 12000)
    );

    stageTimers.push(setTimeout(() => setCurrentStage(3), 22000));
    stageTimers.push(setTimeout(() => setCurrentStage(4), 28000));
    stageTimers.push(setTimeout(() => setCurrentStage(5), 32000));

    stageTimers.push(
      setTimeout(() => {
        const videoData = isExample
          ? knownPaper
          : {
              ...simulateExtraction(uploadName, uploadUrl),
              scenes: generateScenePlan(
                simulateExtraction(uploadName, uploadUrl).sections
              ),
              duration: 120,
            };
        saveVideoToLibrary(jobId!, videoData);
        setCompletedTime(elapsedTimeRef.current);
        stageTimers.push(
          setTimeout(() => navigate(`/v/${jobId}`), 2000)
        );
      }, 36000)
    );

    return () => stageTimers.forEach((t) => clearTimeout(t));
  }, [useRealBackend, jobId, isExample]);

  // ── Stopwatch (elapsed timer) ──
  useEffect(() => {
    if (completedTime !== null) return;
    const interval = setInterval(() => {
      setElapsedTime((prev) => {
        const next = prev + 1;
        elapsedTimeRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [completedTime]);

  const displayPaper = isExample ? knownPaper : paperInfo;

  // Compute the active stage label and overall progress percentage
  const activeStage = processingStages[currentStage];
  const totalStages = processingStages.length;
  let progressPercent = 0;
  if (completedTime !== null) {
    progressPercent = 100;
  } else if (currentStage >= totalStages) {
    progressPercent = 100;
  } else {
    // Base progress from completed stages
    const baseProgress = (currentStage / totalStages) * 100;
    // Add partial progress within the rendering stage using scene counts
    if (activeStage?.id === "rendering" && scenesTotal > 0) {
      const stageSlice = 100 / totalStages;
      progressPercent = Math.round(baseProgress + (scenesDone / scenesTotal) * stageSlice);
    } else {
      progressPercent = Math.round(baseProgress);
    }
  }

  // Build subtitle from paper info
  let paperSubtitle = "";
  if (displayPaper) {
    const authorStr =
      displayPaper.authors?.length > 2
        ? `${displayPaper.authors[0]} et al.`
        : displayPaper.authors?.join(", ") || "";
    paperSubtitle = authorStr
      ? `${displayPaper.title} · ${authorStr}`
      : displayPaper.title;
  }

  // For scene preview: first 4 scenes, mark rendering state
  const previewScenes = scenePlan.slice(0, 4);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAF8" }}>
      {/* ── Nav ── */}
      <nav
        className="flex items-center justify-between"
        style={{ padding: "20px 80px" }}
      >
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div
            className="flex items-center justify-center text-white font-semibold"
            style={{
              width: 32,
              height: 32,
              backgroundColor: "#2563EB",
              borderRadius: 8,
              fontSize: 16,
            }}
          >
            P
          </div>
          <span
            style={{
              fontFamily: "'Source Serif 4', serif",
              fontSize: 22,
              color: "#1A1A1A",
            }}
          >
            PaperVideo
          </span>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/library")}
            className="hover:opacity-70 transition-opacity"
            style={{ color: "#6B7280", fontSize: 14 }}
          >
            Your videos
          </button>
          <a
            href="https://github.com/nikhilanand03/holi-hack"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-70 transition-opacity"
            style={{ color: "#6B7280", fontSize: 14 }}
          >
            GitHub
          </a>
          {user ? (
            <UserMenu user={user} signOut={signOut} />
          ) : (
            <button
              onClick={signInWithGoogle}
              className="hover:opacity-70 transition-opacity"
              style={{ color: "#1A1A1A", fontSize: 14, fontWeight: 500, padding: "6px 16px", border: "1px solid #D4D4D8", borderRadius: 9999, background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>

      {/* ── Header ── */}
      <div className="text-center" style={{ paddingTop: 60 }}>
        <h1
          style={{
            fontFamily: "'Source Serif 4', serif",
            fontSize: 32,
            color: "#1A1A1A",
            fontWeight: 400,
            margin: 0,
          }}
        >
          {completedTime !== null
            ? "Your video is ready"
            : "Turning your paper into a video\u2026"}
        </h1>
        {paperSubtitle && (
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: "#9CA3AF",
              marginTop: 8,
            }}
          >
            {paperSubtitle}
          </p>
        )}
        {!displayPaper && (
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: "#9CA3AF",
              marginTop: 8,
            }}
          >
            {source === "upload" ? uploadName : uploadUrl || "Processing..."}
          </p>
        )}
      </div>

      {/* ── Backend mode indicator ── */}
      {useRealBackend && (
        <div className="text-center" style={{ marginTop: 8 }}>
          <span
            className="text-xs px-2 py-1 rounded inline-block"
            style={{
              backgroundColor: "rgba(5, 150, 105, 0.1)",
              color: "#059669",
            }}
          >
            Connected to pipeline
          </span>
        </div>
      )}

      {/* ── Error state ── */}
      {pipelineError && (
        <div style={{ padding: "24px 240px 0" }}>
          <div
            className="p-4 rounded-xl flex items-start gap-3"
            style={{ backgroundColor: "rgba(220, 38, 38, 0.05)" }}
          >
            <AlertCircle
              size={20}
              style={{ color: "#DC2626", flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <p
                className="text-sm mb-2"
                style={{ color: "#DC2626", fontWeight: 500 }}
              >
                Something went wrong
              </p>
              <p className="text-sm" style={{ color: "#6B7280" }}>
                {pipelineError}
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => navigate("/")}
                  variant="outline"
                >
                  Try again
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/")}
                  variant="outline"
                >
                  Try a different paper
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Progress bar ── */}
      <div style={{ padding: "28px 240px 0" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: "#1A1A1A",
              fontWeight: 500,
            }}
          >
            {completedTime !== null
              ? `Completed in ${completedTime}s`
              : activeStage?.label || "Starting..."}
          </span>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: "#2563EB",
              fontWeight: 600,
            }}
          >
            {progressPercent}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 9999,
            backgroundColor: "#E5E7EB",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 9999,
              backgroundColor: "#2563EB",
              width: `${progressPercent}%`,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {/* ── Stage list ── */}
      <div style={{ padding: "32px 240px 0" }}>
        {processingStages.map((stage, index) => {
          const isComplete = index < currentStage;
          const isCurrent = index === currentStage && !pipelineError;
          const isPending = index > currentStage || !!pipelineError;

          // Right-side info text
          let rightInfo = "";
          if (stage.id === "rendering" && isCurrent && scenesTotal > 0) {
            rightInfo = `${scenesDone}/${scenesTotal} scenes`;
          } else if (stage.id === "rendering" && isComplete && scenesTotal > 0) {
            rightInfo = `${scenesTotal}/${scenesTotal} scenes`;
          }

          return (
            <div
              key={stage.id}
              className="flex items-center"
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #F3F4F6",
                gap: 14,
              }}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {isComplete && (
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      backgroundColor: "#DCFCE7",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6L5 9L10 3"
                        stroke="#16A34A"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
                {isCurrent && (
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: "2px solid #2563EB",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: "#2563EB",
                      }}
                    />
                  </div>
                )}
                {isPending && (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      backgroundColor: "#F9FAFB",
                      border: "1.5px solid #D1D5DB",
                    }}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className="flex-1"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  color: isPending ? "#D1D5DB" : "#1A1A1A",
                  fontWeight: isCurrent ? 500 : 400,
                }}
              >
                {stage.label}
              </span>

              {/* Right info */}
              {rightInfo && (
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    color: isCurrent ? "#2563EB" : "#16A34A",
                    fontWeight: 500,
                  }}
                >
                  {rightInfo}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Scene preview ── */}
      {previewScenes.length > 0 && (
        <div style={{ padding: "40px 240px 60px" }}>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              color: "#9CA3AF",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 16,
              fontWeight: 500,
            }}
          >
            Scene Preview
          </p>
          <div className="flex" style={{ gap: 12 }}>
            {previewScenes.map((scene, i) => {
              // A scene is "done" if we're past the rendering stage, or if during rendering scenesDone > i
              const sceneComplete =
                currentStage > 2 || (currentStage === 2 && scenesDone > i);
              const sceneRendering =
                currentStage === 2 && scenesDone === i && !pipelineError;

              if (sceneComplete) {
                // Completed scene: dark card
                const info = templateInfo[scene.type];
                return (
                  <div
                    key={scene.id}
                    className="flex-1 flex flex-col justify-end"
                    style={{
                      height: 140,
                      borderRadius: 10,
                      backgroundColor: "#1A1A1A",
                      padding: 14,
                      overflow: "hidden",
                    }}
                  >
                    <p
                      style={{
                        color: "#FFFFFF",
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: "'Inter', sans-serif",
                        lineHeight: 1.3,
                      }}
                    >
                      {scene.label}
                    </p>
                    <p
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 11,
                        fontFamily: "'Inter', sans-serif",
                        marginTop: 4,
                      }}
                    >
                      {info?.label || scene.type.replace(/_/g, " ")} · {scene.duration}s
                    </p>
                  </div>
                );
              }

              if (sceneRendering) {
                // Currently rendering: dashed border
                return (
                  <div
                    key={scene.id}
                    className="flex-1 flex flex-col items-center justify-center"
                    style={{
                      height: 140,
                      borderRadius: 10,
                      backgroundColor: "#F3F4F6",
                      border: "2px dashed #D1D5DB",
                    }}
                  >
                    <Loader2
                      size={20}
                      style={{ color: "#9CA3AF" }}
                      className="animate-spin"
                    />
                    <p
                      style={{
                        color: "#9CA3AF",
                        fontSize: 12,
                        fontFamily: "'Inter', sans-serif",
                        marginTop: 8,
                      }}
                    >
                      Rendering...
                    </p>
                  </div>
                );
              }

              // Pending scene: light dashed
              return (
                <div
                  key={scene.id}
                  className="flex-1"
                  style={{
                    height: 140,
                    borderRadius: 10,
                    backgroundColor: "#F9FAFB",
                    border: "1.5px dashed #E5E7EB",
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
