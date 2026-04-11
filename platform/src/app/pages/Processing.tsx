import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  extractArxivId,
  mockPaperData,
  processingStages,
  saveVideoToLibrary,
  saveVideoToSupabase,
  templateInfo,
} from "../lib/data";
import { getJobStatus, getJobData, cancelJob, getQueueStatus, statusToStageIndex } from "../lib/api";
import { useAuth } from "../lib/useAuth";
import { useJobs } from "../lib/JobContext";
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
  const { addJob, removeJob } = useJobs();
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
  const [isQueued, setIsQueued] = useState(false);
  const [queueAhead, setQueueAhead] = useState(0);
  const [showSignIn, setShowSignIn] = useState(false);
  const [scenesDone, setScenesDone] = useState(0);
  const [scenesTotal, setScenesTotal] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const userRef = useRef(user);
  const stageStartTimeRef = useRef<number>(Date.now());
  const lastStageRef = useRef<number>(-1);
  const elapsedTimeRef = useRef(0);
  const pollFailCountRef = useRef(0);
  const paperInfoFetchedRef = useRef(false);
  const pendingSupabaseSaveRef = useRef<{ meta: any; blobUrl: string | null } | null>(null);
  const scenePlanFetchedRef = useRef(false);

  const knownPaper = isExample ? mockPaperData[paperId!] : null;

  // ── Real backend polling (non-demo, non-example uploads) ──
  const useRealBackend = !isDemo && !isExample && !!jobId;

  // Keep user ref in sync for use inside poll callback
  useEffect(() => { userRef.current = user; }, [user]);

  // Save to Supabase when user signs in after video is done
  useEffect(() => {
    if (!user) return;

    // Check in-memory ref first
    if (pendingSupabaseSaveRef.current && jobId) {
      const { meta, blobUrl } = pendingSupabaseSaveRef.current;
      pendingSupabaseSaveRef.current = null;
      localStorage.removeItem("pendingVideoSave");
      saveVideoToSupabase(user.id, jobId, {
        ...meta,
        arxiv_id: extractArxivId(uploadUrl),
        blob_url: blobUrl,
      }).then(() => {
        console.log(`[Pipeline ${jobId}] Saved to Supabase after sign-in`);
        navigate(`/v/${jobId}`);
      }).catch(() => navigate(`/v/${jobId}`));
      return;
    }

    // Check localStorage (survives OAuth redirect)
    const pendingRaw = localStorage.getItem("pendingVideoSave");
    if (pendingRaw) {
      try {
        const pending = JSON.parse(pendingRaw);
        localStorage.removeItem("pendingVideoSave");
        saveVideoToSupabase(user.id, pending.jobId, {
          ...pending.meta,
          arxiv_id: extractArxivId(pending.uploadUrl),
          blob_url: pending.blobUrl,
        }).then(() => {
          console.log(`[Pipeline ${pending.jobId}] Saved to Supabase after redirect sign-in`);
          navigate(`/v/${pending.jobId}`);
        }).catch(() => navigate(`/v/${pending.jobId}`));
      } catch {
        localStorage.removeItem("pendingVideoSave");
      }
    }
  }, [user]);

  // Register job in context so banner can track it
  useEffect(() => {
    if (useRealBackend && jobId) {
      addJob(jobId, uploadName.replace(/\.pdf$/i, "") || "Paper");
    }
  }, [useRealBackend, jobId]);

  useEffect(() => {
    if (!useRealBackend) return;

    const poll = async () => {
      try {
        const status = await getJobStatus(jobId!);
        pollFailCountRef.current = 0;
        const stageIdx = statusToStageIndex(status.status);

        // Log only on stage changes to reduce console spam
        if (stageIdx !== currentStage) {
          console.log(`[Pipeline ${jobId}] ${status.status} | stage ${stageIdx}/5 | scenes ${status.scenes_done}/${status.scenes_total}`);
        }

        const queued = status.status === "queued";
        setIsQueued(queued);
        if (queued) {
          try {
            const qs = await getQueueStatus(jobId!);
            setQueueAhead(Math.max(0, qs.queue_size - 1));
          } catch { /* ignore */ }
        }
        setCurrentStage(stageIdx);
        setScenesTotal(status.scenes_total);
        setScenesDone(status.scenes_done);

        // After extraction, fetch real paper info (once) — skip if still queued
        if (stageIdx >= 1 && !paperInfoFetchedRef.current && status.status !== "queued") {
          paperInfoFetchedRef.current = true;
          console.log(`[Pipeline ${jobId}] Fetching paper info...`);
          try {
            const data = await getJobData(jobId!);
            if (data.paper) {
              console.log(`[Pipeline ${jobId}] Paper extracted: "${data.paper.title}" — ${data.paper.sections?.length || 0} sections, ${data.paper.figures?.length || 0} figures, ${data.paper.tables?.length || 0} tables`);
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

        // After planning, fetch real scene plan (once) — skip if still queued
        if (stageIdx >= 2 && !scenePlanFetchedRef.current && status.status !== "queued") {
          scenePlanFetchedRef.current = true;
          console.log(`[Pipeline ${jobId}] Fetching scene plan...`);
          try {
            const data = await getJobData(jobId!);
            if (data.plan?.scenes) {
              console.log(`[Pipeline ${jobId}] Plan ready: ${data.plan.scenes.length} scenes`);
              data.plan.scenes.forEach((s: any) => {
                console.log(`  Scene ${s.scene_number}: [${s.template}] ${(s.narration || "").slice(0, 60)}...`);
              });
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
          console.log(`[Pipeline ${jobId}] %c✓ DONE%c — navigating to viewer in 2s`, "color: #16A34A; font-weight: bold", "color: inherit");
          clearInterval(pollingRef.current);
          let videoMeta: any = null;
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
            videoMeta = {
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
              blobUrl: status.blob_url || undefined,
            };
            saveVideoToLibrary(jobId!, videoMeta);
          } catch {
            // Minimal fallback — only use filename, no fake authors/sections
            videoMeta = {
              title: uploadName.replace(/\.pdf$/i, "") || "Uploaded Paper",
              authors: [],
              venue: "",
              year: new Date().getFullYear(),
              scenes: scenePlan,
              duration: 120,
              realJobId: jobId,
              blobUrl: status.blob_url || undefined,
            };
            saveVideoToLibrary(jobId!, videoMeta);
          }
          // Persist to Supabase for cross-device access
          if (userRef.current && videoMeta) {
            try {
              await saveVideoToSupabase(userRef.current.id, jobId!, {
                ...videoMeta,
                arxiv_id: extractArxivId(uploadUrl),
                blob_url: status.blob_url || null,
              });
            } catch (e) {
              console.warn("Supabase save failed:", e);
            }
          } else if (videoMeta) {
            // User not signed in — persist for after sign-in redirect
            const pending = {
              jobId: jobId!,
              meta: videoMeta,
              blobUrl: status.blob_url || null,
              uploadUrl: uploadUrl || "",
            };
            localStorage.setItem("pendingVideoSave", JSON.stringify(pending));
            pendingSupabaseSaveRef.current = { meta: videoMeta, blobUrl: status.blob_url || null };
          }
          setCompletedTime(elapsedTimeRef.current);
          removeJob(jobId!);
          if (userRef.current) {
            setTimeout(() => navigate(`/v/${jobId}`), 2000);
          } else {
            setShowSignIn(true);
          }
        }

        // Failed
        if (status.status === "failed") {
          console.error(`[Pipeline ${jobId}] ✗ FAILED:`, status.error);
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
  // Weighted: extract=10%, plan=15%, render=50%, tts=10%, assemble=15%
  const STAGE_WEIGHTS = [10, 15, 50, 10, 15];
  const activeStage = processingStages[currentStage];
  let progressPercent = 0;
  if (completedTime !== null) {
    progressPercent = 100;
  } else if (currentStage >= processingStages.length) {
    progressPercent = 100;
  } else {
    // Sum weights of completed stages
    let completed = 0;
    for (let i = 0; i < currentStage; i++) completed += STAGE_WEIGHTS[i] || 0;
    // Add partial progress within current stage
    const currentWeight = STAGE_WEIGHTS[currentStage] || 0;
    if (activeStage?.id === "rendering" && scenesTotal > 0) {
      completed += (scenesDone / scenesTotal) * currentWeight;
    }
    progressPercent = Math.round(completed);
  }

  // Track when each stage starts for countdown
  if (currentStage !== lastStageRef.current) {
    lastStageRef.current = currentStage;
    stageStartTimeRef.current = Date.now();
  }

  // Estimated time remaining — counts down within each stage
  const estimatedTimeRemaining = (() => {
    if (completedTime !== null || pipelineError) return null;

    // If queued, estimate based on queue position
    // We don't know if jobs ahead are brief or detailed, so use an average
    const AVG_JOB_TIME = 5 * 60; // ~5 min average
    if (isQueued) {
      if (queueAhead <= 0) return null;
      const waitMins = Math.ceil((queueAhead * AVG_JOB_TIME) / 60);
      return `~${waitMins} min wait`;
    }

    const STAGE_ESTIMATES: Record<number, number> = {
      0: 30,   // Extracting
      1: 40,   // Planning
      // 2 is dynamic (rendering)
      3: 5,    // TTS
      4: 20,   // Assembling
    };

    const totalScenes = scenesTotal || scenePlan.length || 12;
    const RENDER_PER_SCENE = 8;

    // Time elapsed in current stage
    const stageElapsed = Math.floor((Date.now() - stageStartTimeRef.current) / 1000);

    // Current stage estimate
    let currentStageEstimate: number;
    if (currentStage === 2) {
      const scenesLeft = Math.max(0, totalScenes - scenesDone);
      currentStageEstimate = scenesLeft * RENDER_PER_SCENE;
    } else {
      currentStageEstimate = STAGE_ESTIMATES[currentStage] ?? 10;
    }

    // Time left in current stage (don't go below 0)
    const currentStageRemaining = Math.max(0, currentStageEstimate - stageElapsed);

    // Time for future stages
    let futureTime = 0;
    for (let s = currentStage + 1; s <= 4; s++) {
      if (s === 2) {
        futureTime += totalScenes * RENDER_PER_SCENE;
      } else {
        futureTime += STAGE_ESTIMATES[s] ?? 10;
      }
    }

    const remaining = currentStageRemaining + futureTime;
    if (remaining <= 0) return null;

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    if (mins > 0) return `~${mins}m ${secs}s remaining`;
    return `~${secs}s remaining`;
  })();

  // Build subtitle from paper info (title only, no authors)
  const paperSubtitle = displayPaper?.title || "";

  // For scene preview: first 4 scenes, mark rendering state
  // Full scene plan shown below progress stages

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
          {showSignIn
            ? "Your video is ready!"
            : completedTime !== null
            ? "Your video is ready"
            : isQueued
            ? "You're in the queue"
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

      {/* ── Sign in popup ── */}
      {showSignIn && !user && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: "40px 36px",
              maxWidth: 400,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            }}
          >
            <div style={{
              width: 48, height: 48, backgroundColor: "#EFF6FF", borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 style={{
              fontFamily: "'Source Serif 4', serif",
              fontSize: 22,
              fontWeight: 600,
              color: "#1A1A1A",
              marginBottom: 8,
            }}>
              Your video is ready!
            </h2>
            <p style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              color: "#6B7280",
              lineHeight: 1.6,
              marginBottom: 24,
            }}>
              Sign in for free to save this video to your library and access it from any device.
            </p>
            <button
              onClick={signInWithGoogle}
              style={{
                width: "100%",
                padding: "12px 24px",
                backgroundColor: "#FFFFFF",
                color: "#6B7280",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign in with Google
            </button>
          </div>
        </div>
      )}

      {/* ── Info message ── */}
      {useRealBackend && completedTime === null && !pipelineError && !isQueued && user && (
        <div className="text-center" style={{ marginTop: 8 }}>
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              color: "#9CA3AF",
            }}
          >
            You can leave this page. We'll save your video to your library when it's done.
          </span>
        </div>
      )}
      {useRealBackend && completedTime === null && !pipelineError && !user && (
        <div className="text-center" style={{ marginTop: 8 }}>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#9CA3AF" }}>
            Want to leave and come back later?{" "}
          </span>
          <button
            onClick={signInWithGoogle}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              color: "#2563EB",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Sign in
          </button>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#9CA3AF" }}>
            {" "}to save your progress.
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
              : isQueued
              ? "Waiting in queue..."
              : activeStage?.label || "Starting..."}
            {estimatedTimeRemaining && (
              <span style={{ fontWeight: 400, color: "#9CA3AF", marginLeft: 8, fontSize: 13 }}>
                {estimatedTimeRemaining}
              </span>
            )}
          </span>
          <div className="flex items-center gap-3">
            {completedTime === null && !pipelineError && useRealBackend && (
              <button
                onClick={() => {
                  if (window.confirm(isQueued ? "Cancel this video?" : "Stop generating this video? Progress will be lost.")) {
                    if (jobId) {
                      console.log(`[Pipeline ${jobId}] Cancelling...`);
                      cancelJob(jobId);
                      removeJob(jobId);
                      clearInterval(pollingRef.current);
                      navigate("/");
                    }
                  }
                }}
                style={{
                  background: "none",
                  border: "1px solid #D1D5DB",
                  borderRadius: 6,
                  padding: "4px 12px",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 12,
                  color: "#6B7280",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#DC2626"; e.currentTarget.style.borderColor = "#FCA5A5"; e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {isQueued ? "Cancel" : "Stop"}
              </button>
            )}
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

      {/* ── Queued message ── */}
      {isQueued && (
        <div style={{ padding: "40px 240px", textAlign: "center" }}>
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 15,
            color: "#6B7280",
            lineHeight: 1.6,
          }}>
            {queueAhead > 0
              ? `${queueAhead} video${queueAhead > 1 ? "s" : ""} ahead of yours. Your video will start automatically once it's your turn.`
              : "Your video will start shortly."}
          </p>
        </div>
      )}

      {/* ── Stage list ── */}
      {!isQueued && <div style={{ padding: "32px 240px 0" }}>
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
                  <Loader2
                    size={24}
                    color="#2563EB"
                    className="animate-spin"
                  />
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
      </div>}

      {/* ── Insight ticker ── */}
      {completedTime === null && !pipelineError && (() => {
        const blogQuotes = [
          "\"What if the paper was a video? A short, digestible video that walks you through the key ideas?\"",
          "\"Instead of asking the LLM to freestyle a script, we gave it a rigid JSON template and asked it to fill in specific fields.\"",
          "\"It takes a seemingly chaotic probabilistic system and imposes clean, mathematical structure on it — without sacrificing speed.\"",
          "\"The difference between producing coherent videos and producing garbled nonsense? Constrained decoding.\"",
          "\"The LLM was no longer freestyle-generating a script. At every token step, it was being constrained to produce valid output.\"",
          "\"Reading dense academic text takes a specific kind of mental energy that I don't always have at 10pm.\"",
          "\"Every field was always present, every value was the right type — no extra commentary that would break our parser.\"",
          "\"We build a Finite State Machine of the grammar. The allowed tokens change depending on the current state of the output.\"",
          "\"The precomputation happens once, and every subsequent step is instant — a massive improvement over the naive approach.\"",
        ];
        const pipelineInfo = [
          `Your video will have ${scenesTotal || scenePlan.length || "~15"} scenes, each with its own animation and narration.`,
          "Each scene is rendered using Remotion, a React-based video framework that produces cinema-quality animations.",
          "The narration is synthesized using Azure Neural Voice, producing natural-sounding speech for each scene.",
          "Every research paper is analyzed section-by-section to extract figures, tables, and key findings.",
          "PaperVideo uses structured outputs with constrained decoding to guarantee valid scene plans every time.",
          "Tables and figures from the paper are automatically extracted and included as dedicated visual scenes.",
          "The video script is planned by GPT-4o, which sees the full paper and crafts a coherent narrative arc.",
          "Each template — from bullet lists to data tables to charts — is a hand-crafted React animation component.",
          "Scene animations are rendered in parallel for speed, then assembled with narration into the final video.",
          "PaperVideo was built in a weekend hackathon and has been iteratively improved ever since.",
          "The entire pipeline runs on Azure — from PDF extraction to video assembly — in under 5 minutes.",
        ];
        // Alternate: even ticks = blog quote, odd ticks = pipeline info
        const tick = Math.floor(elapsedTime / 8);
        const currentInsight = tick % 2 === 0
          ? blogQuotes[Math.floor(tick / 2) % blogQuotes.length]
          : pipelineInfo[Math.floor(tick / 2) % pipelineInfo.length];
        return (
          <div style={{ padding: "32px 240px 0" }}>
            <div
              style={{
                padding: "20px 28px",
                backgroundColor: "#FAFAF8",
                borderLeft: "3px solid #D1D5DB",
                borderRadius: "0 10px 10px 0",
              }}
            >
              <p style={{
                fontFamily: "'Source Serif 4', serif",
                fontSize: 14,
                fontStyle: "italic",
                color: "#3F3F46",
                lineHeight: 1.6,
                margin: 0,
              }}>
                {currentInsight}
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Blog link ── */}
      {completedTime === null && !pipelineError && (
        <div style={{ padding: "24px 240px 0", textAlign: "center" }}>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#9CA3AF" }}>
            Bored?{" "}
            <button
              onClick={() => alert("You're early! The blog comes out tomorrow, Apr 12th at 9 AM.")}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13, color: "#2563EB", padding: 0 }}
            >
              Read about how we built this →
            </button>
          </span>
        </div>
      )}

      {/* ── Scene plan ── */}
      {scenePlan.length > 0 && !isQueued && (
        <div style={{ padding: "40px 240px 60px" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
            <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 20, color: "#1A1A1A", fontWeight: 600 }}>
              Script
            </span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#9CA3AF" }}>
              {scenePlan.length} scenes
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {scenePlan.map((scene, i) => {
              const RENDER_CONCURRENCY = 4;
              const sceneComplete =
                currentStage > 2 || (currentStage === 2 && scenesDone > i);
              const sceneRendering =
                currentStage === 2 && i >= scenesDone && i < scenesDone + RENDER_CONCURRENCY && !pipelineError;
              const isSection = scene.type === "section_header";

              return (
                <div
                  key={scene.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: isSection ? "16px 0 8px" : "8px 0",
                    borderBottom: isSection ? "none" : "1px solid #F3F4F6",
                    opacity: sceneComplete ? 1 : sceneRendering ? 1 : currentStage >= 2 ? 0.4 : 1,
                    transition: "opacity 0.3s",
                  }}
                >
                  {/* Status indicator */}
                  <div style={{ flexShrink: 0, marginTop: isSection ? 4 : 2, width: 20 }}>
                    {sceneComplete ? (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <circle cx="9" cy="9" r="9" fill="#DCFCE7" />
                        <path d="M5 9L8 12L13 6" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : sceneRendering ? (
                      <Loader2 size={18} color="#2563EB" className="animate-spin" />
                    ) : (
                      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #E5E7EB" }} />
                    )}
                  </div>

                  {/* Content */}
                  {isSection ? (
                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontFamily: "'Source Serif 4', serif",
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        letterSpacing: "-0.01em",
                      }}>
                        {scene.label}
                      </span>
                    </div>
                  ) : (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
                        <span style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 13,
                          fontWeight: 500,
                          color: sceneComplete ? "#1A1A1A" : "#3F3F46",
                        }}>
                          {scene.label}
                        </span>
                        <span style={{
                          fontSize: 10,
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: "#A1A1AA",
                          backgroundColor: "#F4F4F5",
                          padding: "1px 6px",
                          borderRadius: 3,
                        }}>
                          {scene.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      {scene.narration && (
                        <p style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 12,
                          color: "#9CA3AF",
                          lineHeight: 1.5,
                          margin: 0,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical" as const,
                        }}>
                          {scene.narration}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
