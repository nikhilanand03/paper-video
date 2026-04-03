import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  CheckCircle2,
  Loader2,
  ArrowLeft,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  mockPaperData,
  processingStages,
  saveVideoToLibrary,
  templateInfo,
} from "../lib/data";
import { getJobStatus, getJobData, statusToStageIndex } from "../lib/api";

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

  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;
  const displayPaper = isExample ? knownPaper : paperInfo;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAF8" }}>
      {/* Top bar */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div
            style={{ fontFamily: "'Instrument Serif', serif" }}
            className="text-2xl cursor-pointer"
            onClick={() => navigate("/")}
          >
            PaperVideo
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-[#6B7280] hover:text-[#1A1A1A] transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            New Video
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left column — Paper info */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB]">
              {displayPaper ? (
                <>
                  <h2
                    className="mb-4"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: "24px",
                      color: "#1A1A1A",
                      fontWeight: 600,
                    }}
                  >
                    {displayPaper.title}
                  </h2>
                  <p className="mb-4 text-sm" style={{ color: "#6B7280" }}>
                    {displayPaper.authors.join(", ")}
                  </p>
                  {displayPaper.venue && (
                    <p className="mb-4 text-sm" style={{ color: "#6B7280" }}>
                      {displayPaper.venue} · {displayPaper.year}
                    </p>
                  )}
                  <div className="pt-4 border-t border-[#E5E7EB]">
                    <h3
                      className="mb-2"
                      style={{ color: "#1A1A1A", fontWeight: 500 }}
                    >
                      Abstract
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "#6B7280" }}
                    >
                      {displayPaper.abstract}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <FileText size={24} style={{ color: "#2563EB" }} />
                    <div>
                      <p
                        style={{
                          color: "#1A1A1A",
                          fontWeight: 500,
                          fontSize: "14px",
                        }}
                      >
                        {source === "upload" ? uploadName : uploadUrl}
                      </p>
                      <p className="text-xs" style={{ color: "#6B7280" }}>
                        {source === "upload" ? "PDF Upload" : "URL"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 animate-pulse">
                    <div
                      className="h-6 rounded"
                      style={{ backgroundColor: "#F4F4F0", width: "85%" }}
                    />
                    <div
                      className="h-4 rounded"
                      style={{ backgroundColor: "#F4F4F0", width: "60%" }}
                    />
                    <div
                      className="h-4 rounded"
                      style={{ backgroundColor: "#F4F4F0", width: "40%" }}
                    />
                    <div className="mt-6 pt-4 border-t border-[#E5E7EB]">
                      <div
                        className="h-4 rounded mb-2"
                        style={{ backgroundColor: "#F4F4F0", width: "30%" }}
                      />
                      <div
                        className="h-3 rounded mb-2"
                        style={{ backgroundColor: "#F4F4F0", width: "100%" }}
                      />
                      <div
                        className="h-3 rounded mb-2"
                        style={{ backgroundColor: "#F4F4F0", width: "90%" }}
                      />
                      <div
                        className="h-3 rounded"
                        style={{ backgroundColor: "#F4F4F0", width: "75%" }}
                      />
                    </div>
                  </div>
                  <p className="text-sm mt-4" style={{ color: "#9CA3AF" }}>
                    Reading your paper...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right column — Progress */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB]">
              <h2
                className="mb-2"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "24px",
                  color: "#1A1A1A",
                  fontWeight: 600,
                }}
              >
                Generating your video
              </h2>

              {/* Backend mode indicator */}
              {useRealBackend && (
                <p
                  className="mb-2 text-xs px-2 py-1 rounded inline-block"
                  style={{
                    backgroundColor: "rgba(5, 150, 105, 0.1)",
                    color: "#059669",
                  }}
                >
                  Connected to pipeline
                </p>
              )}

              {completedTime !== null ? (
                <p className="mb-8 text-sm" style={{ color: "#059669", fontWeight: 500 }}>
                  Completed in {completedTime} seconds
                </p>
              ) : (
                <div className="mb-8">
                  <p className="text-sm" style={{ color: "#6B7280" }}>
                    Elapsed: {minutes}:{seconds.toString().padStart(2, "0")}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                    (typically takes 5–6 minutes)
                  </p>
                </div>
              )}

              {/* Error state */}
              {pipelineError && (
                <div
                  className="mb-8 p-4 rounded-xl flex items-start gap-3"
                  style={{
                    backgroundColor: "rgba(220, 38, 38, 0.05)",
                  }}
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
              )}

              {/* Progress stepper */}
              <div className="space-y-6 mb-12">
                {processingStages.map((stage, index) => {
                  const isComplete = index < currentStage;
                  const isCurrent = index === currentStage && !pipelineError;
                  const isPending = index > currentStage || !!pipelineError;

                  return (
                    <div key={stage.id} className="flex gap-4 items-start">
                      <div className="flex-shrink-0 mt-1">
                        {isComplete && (
                          <CheckCircle2
                            size={24}
                            style={{ color: "#059669" }}
                          />
                        )}
                        {isCurrent && (
                          <Loader2
                            size={24}
                            style={{ color: "#2563EB" }}
                            className="animate-spin"
                          />
                        )}
                        {isPending && (
                          <div
                            className="w-6 h-6 rounded-full border-2"
                            style={{ borderColor: "#E5E7EB" }}
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <p
                          style={{
                            color:
                              isComplete || isCurrent ? "#1A1A1A" : "#9CA3AF",
                            fontWeight: 500,
                          }}
                        >
                          {stage.label}
                        </p>
                        <p
                          className="text-sm"
                          style={{
                            color:
                              isComplete || isCurrent ? "#6B7280" : "#9CA3AF",
                          }}
                        >
                          {stage.description}
                          {stage.id === "rendering" && isCurrent && scenesTotal > 0 && (
                            <span style={{ color: "#2563EB", fontWeight: 500 }}>
                              {" "}— {scenesDone}/{scenesTotal} scenes
                            </span>
                          )}
                          {stage.id === "rendering" && isComplete && scenesTotal > 0 && (
                            <span style={{ color: "#059669", fontWeight: 500 }}>
                              {" "}— {scenesTotal}/{scenesTotal} scenes
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Scene plan preview */}
              {scenePlan.length > 0 && (
                <div className="pt-8 border-t border-[#E5E7EB]">
                  <h3
                    className="mb-4"
                    style={{ color: "#1A1A1A", fontWeight: 600 }}
                  >
                    Scene Plan — {scenePlan.length} scenes
                  </h3>
                  <div className="space-y-3">
                    {scenePlan.map((scene) => {
                      const info = templateInfo[scene.type];
                      return (
                        <div
                          key={scene.id}
                          className="flex gap-3 items-start p-3 rounded-lg"
                          style={{ backgroundColor: "#F4F4F0" }}
                        >
                          <div
                            className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-sm"
                            style={{
                              backgroundColor: "#2563EB",
                              color: "#FFFFFF",
                              fontWeight: 500,
                            }}
                          >
                            {scene.id}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              style={{ color: "#1A1A1A", fontWeight: 500 }}
                              className="text-sm"
                            >
                              {scene.label}
                            </p>
                            <p
                              style={{ color: "#6B7280" }}
                              className="text-xs flex items-center gap-1"
                            >
                              <span>{info?.icon || "📄"}</span>
                              <span>
                                {info?.label ||
                                  scene.type.replace(/_/g, " ")}{" "}
                                · {scene.duration}s
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
