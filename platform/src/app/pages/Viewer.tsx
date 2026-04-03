import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Play,
  Pause,
  Volume2,
  Maximize,
  ExternalLink,
  Share2,
  Download,
  RefreshCw,
  StickyNote,
  FileText,
  X,
  Trash2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  getVideoById,
  getVideoByArxivId,
  incrementViewCount,
  getNotes,
  saveNote,
  deleteNote,
  templateInfo,
  seedSampleItems,
  examplePapers,
  mockPaperData,
  saveVideoToLibrary,
} from "../lib/data";
import { getStreamUrl, getDownloadUrl, getChapters, getJobData } from "../lib/api";
import { Textarea } from "../components/ui/textarea";

export default function Viewer() {
  const { videoId, arxivId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"paper" | "notes">("paper");
  const [notes, setNotes] = useState<any[]>([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [realDuration, setRealDuration] = useState<number | null>(null);
  const [noteTimestamp, setNoteTimestamp] = useState(0);
  const [shortcutBarDismissed, setShortcutBarDismissed] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chapters, setChapters] = useState<
    { start: number; duration: number }[] | null
  >(null);
  const [realScenes, setRealScenes] = useState<any[] | null>(null);

  // Try localStorage first; if not found, seed samples and retry;
  // if still not found, create entry on-the-fly from sample data
  seedSampleItems();
  let video = arxivId ? getVideoByArxivId(arxivId) : getVideoById(videoId!);
  if (!video && arxivId) {
    const sample = examplePapers.find((p) => p.arxivId === arxivId);
    if (sample) {
      const data = mockPaperData[sample.id];
      if (data) {
        const entry = {
          id: `sample_${sample.id}`,
          ...data,
          arxivId: sample.arxivId,
          realJobId: sample.realJobId,
          blobUrl: sample.blobUrl,
          duration: sample.duration || data.duration,
          generatedAt: new Date().toISOString(),
          views: 0,
          isSample: true,
        };
        saveVideoToLibrary(entry.id, entry);
        video = entry;
      }
    }
  }
  const resolvedVideoId = video?.id || videoId;

  useEffect(() => {
    if (resolvedVideoId) {
      incrementViewCount(resolvedVideoId);
      setNotes(getNotes(resolvedVideoId));
    }
  }, [resolvedVideoId]);

  // Fetch real chapter timestamps and scene data for backend videos
  useEffect(() => {
    if (video?.realJobId) {
      getChapters(video.realJobId).then((ch) => {
        if (ch && ch.length > 0) setChapters(ch);
      });
      getJobData(video.realJobId).then((data) => {
        if (data?.plan?.scenes) {
          setRealScenes(
            data.plan.scenes.map((s: any, i: number) => ({
              id: s.scene_number || i + 1,
              type: s.template,
              label: s.data?.title || s.data?.heading || s.template.replace(/_/g, " "),
              duration: s.duration_seconds || 10,
              narration: s.narration,
              sectionId: null,
            }))
          );
        }
      }).catch(() => {});
    }
  }, [video?.realJobId]);

  // Fullscreen toggle
  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Derive effective duration: prefer real video duration, fall back to localStorage data
  const effectiveDuration = realDuration ?? video?.duration ?? 0;

  useEffect(() => {
    // Simulate video playback
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && video) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1 * playbackSpeed;
          if (next >= effectiveDuration) {
            setIsPlaying(false);
            return effectiveDuration;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, video, effectiveDuration]);

  useEffect(() => {
    // Update current scene based on time, using real chapters if available
    if (video?.scenes && sceneSegments.length > 0) {
      for (let i = sceneSegments.length - 1; i >= 0; i--) {
        if (currentTime >= sceneSegments[i].startTime) {
          setCurrentSceneIndex(i);
          break;
        }
      }
    }
  }, [currentTime, video, chapters]);

  if (!video) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#FAFAF8" }}
      >
        <div className="text-center">
          <p style={{ color: "#1A1A1A" }} className="mb-4">
            Video not found
          </p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const handlePlayPause = () => {
    if (videoElRef.current) {
      if (videoElRef.current.paused) {
        videoElRef.current.play();
      } else {
        videoElRef.current.pause();
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleSceneClick = (index: number) => {
    // Use sceneSegments for accurate seek when available
    if (sceneSegments[index]) {
      const time = sceneSegments[index].startTime;
      setCurrentTime(time);
      setCurrentSceneIndex(index);
      if (videoElRef.current) {
        videoElRef.current.currentTime = time;
      }
    }
  };

  const handlePreviousScene = () => {
    if (currentSceneIndex > 0) {
      handleSceneClick(currentSceneIndex - 1);
    }
  };

  const handleNextScene = () => {
    if (currentSceneIndex < activeScenes.length - 1) {
      handleSceneClick(currentSceneIndex + 1);
    }
  };

  const handleAddNote = () => {
    if (newNoteText.trim()) {
      saveNote(resolvedVideoId!, {
        timestamp: noteTimestamp,
        text: newNoteText,
      });
      setNotes(getNotes(resolvedVideoId!));
      setNewNoteText("");
      setIsAddingNote(false);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    deleteNote(resolvedVideoId!, noteId);
    setNotes(getNotes(resolvedVideoId!));
  };

  const handleNoteClick = (timestamp: number) => {
    setCurrentTime(timestamp);
    setIsPlaying(false);
  };

  const handleShare = () => {
    const shareUrl = video?.arxivId
      ? `${window.location.origin}/abs/${video.arxivId}`
      : window.location.href;
    navigator.clipboard.writeText(shareUrl);
    alert("Link copied to clipboard!");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  // Use real scenes from backend when available, else fall back to localStorage mock
  const activeScenes = realScenes && chapters && realScenes.length === chapters.length
    ? realScenes
    : video.scenes;

  const currentScene = activeScenes[currentSceneIndex];
  const currentSection = video.sections?.find(
    (s: any) => s.id === currentScene?.sectionId
  );
  const currentTemplateInfo = templateInfo[currentScene?.type] || {
    label: currentScene?.type?.replace(/_/g, " "),
    icon: "📄",
  };

  // Check if we have a real video — prefer blob URL (works without backend), fall back to stream
  const hasRealVideo = !!video.realJobId || !!video.blobUrl;
  const streamUrl = video.blobUrl || (video.realJobId ? getStreamUrl(video.realJobId) : null);

  // Compute scene segment data for the chapter progress bar.
  // Use real chapter timestamps from backend when available (matched by count to activeScenes).
  const useRealChapters = chapters && chapters.length === activeScenes.length;
  const totalSceneDuration = useRealChapters
    ? chapters.reduce((sum, ch) => sum + ch.duration, 0)
    : activeScenes.reduce((sum: number, s: any) => sum + s.duration, 0);
  const sceneSegments = activeScenes.map((scene: any, index: number) => {
    if (useRealChapters) {
      const ch = chapters[index];
      return {
        scene,
        index,
        startTime: ch.start,
        endTime: ch.start + ch.duration,
        widthPercent: (ch.duration / totalSceneDuration) * 100,
      };
    }
    let startTime = 0;
    for (let i = 0; i < index; i++) {
      startTime += activeScenes[i].duration;
    }
    return {
      scene,
      index,
      startTime,
      endTime: startTime + scene.duration,
      widthPercent: (scene.duration / totalSceneDuration) * 100,
    };
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handlePreviousScene();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleNextScene();
          break;
        case "n":
        case "N":
          e.preventDefault();
          setNoteTimestamp(currentTime);
          setIsAddingNote(true);
          setIsPlaying(false);
          break;
        case "p":
        case "P":
          e.preventDefault();
          setIsPanelCollapsed(!isPanelCollapsed);
          break;
        case "t":
        case "T":
          e.preventDefault();
          setActiveTab(activeTab === "paper" ? "notes" : "paper");
          break;
        case "f":
        case "F":
          e.preventDefault();
          handleFullscreen();
          break;
        case "?":
          e.preventDefault();
          setShowShortcutsModal(true);
          break;
        case "Escape":
          if (showShortcutsModal) {
            e.preventDefault();
            setShowShortcutsModal(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isPlaying, isPanelCollapsed, activeTab, currentSceneIndex, currentTime, showShortcutsModal]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAF8" }}>
      {/* Top bar */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="max-w-[1920px] mx-auto px-8 py-4 flex items-center justify-between">
          <div
            style={{ fontFamily: "'Instrument Serif', serif" }}
            className="text-2xl cursor-pointer"
            onClick={() => navigate("/")}
          >
            PaperVideo
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/library")}
              className="text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
            >
              Library
            </button>
            <button className="text-[#6B7280] hover:text-[#1A1A1A] transition-colors">
              Sign In
            </button>
          </div>
        </div>
      </div>

      {/* Main viewer */}
      <div className="max-w-[1920px] mx-auto">
        <div className="flex">
          {/* Left panel — Video player */}
          <div
            className="flex-1 p-8 transition-all"
            style={{
              width: isPanelCollapsed ? "100%" : "65%",
            }}
          >
            {/* Video player area */}
            <div
              ref={containerRef}
              className="relative rounded-2xl overflow-hidden mb-8"
              style={{
                backgroundColor: "#1A1A1A",
                aspectRatio: "16/9",
              }}
            >
              {hasRealVideo && streamUrl ? (
                /* -- Real video from backend -- */
                <video
                  ref={videoElRef}
                  src={streamUrl}
                  className="w-full h-full object-contain"
                  onTimeUpdate={() => {
                    if (videoElRef.current) {
                      setCurrentTime(videoElRef.current.currentTime);
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onLoadedMetadata={() => {
                    if (videoElRef.current) {
                      setRealDuration(videoElRef.current.duration);
                    }
                  }}
                />
              ) : (
                /* -- Demo placeholder -- */
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-12 max-w-4xl">
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6"
                      style={{
                        backgroundColor: "rgba(37, 99, 235, 0.2)",
                        color: "#93B4F5",
                        fontSize: "14px",
                      }}
                    >
                      <span>{currentTemplateInfo.icon}</span>
                      <span>{currentTemplateInfo.label}</span>
                    </div>
                    <div
                      style={{
                        fontFamily: "'Instrument Serif', serif",
                        fontSize: "42px",
                        color: "#FFFFFF",
                        marginBottom: "16px",
                        lineHeight: 1.2,
                      }}
                    >
                      {currentScene?.type === "title_card"
                        ? video.title
                        : `Scene ${currentSceneIndex + 1}: ${currentScene?.label}`}
                    </div>
                    <div
                      style={{
                        color: "#9CA3AF",
                        fontSize: "18px",
                        lineHeight: 1.6,
                        maxWidth: "700px",
                        margin: "0 auto",
                      }}
                    >
                      {currentScene?.narration}
                    </div>
                  </div>
                </div>
              )}

              {/* Play/Pause overlay */}
              <button
                onClick={handlePlayPause}
                className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
              >
                {isPlaying ? (
                  <Pause size={64} color="#FFFFFF" />
                ) : (
                  <Play size={64} color="#FFFFFF" />
                )}
              </button>

              {/* Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-12 px-4 pb-3">
                {/* Chapter-segmented progress bar */}
                <div className="relative mb-3 group/progress">
                  {/* Hover tooltip for segments */}
                  {hoveredSegment !== null && (
                    (() => {
                      const seg = sceneSegments[hoveredSegment];
                      let leftPercent = 0;
                      for (let i = 0; i < seg.index; i++) {
                        leftPercent += sceneSegments[i].widthPercent;
                      }
                      return (
                        <div
                          className="absolute bottom-full mb-2 whitespace-nowrap px-2.5 py-1.5 rounded text-xs shadow-lg z-50 pointer-events-none -translate-x-1/2"
                          style={{
                            left: `${leftPercent + seg.widthPercent / 2}%`,
                            backgroundColor: "rgba(0,0,0,0.85)",
                            color: "#FFFFFF",
                          }}
                        >
                          <span className="font-medium">{seg.scene.label}</span>
                          <span className="ml-1.5 opacity-70">{formatTime(seg.startTime)}</span>
                        </div>
                      );
                    })()
                  )}

                  {/* Current scene label */}
                  {hoveredSegment === null && sceneSegments.map((seg: any) => {
                    if (seg.index !== currentSceneIndex) return null;
                    let leftPercent = 0;
                    for (let i = 0; i < seg.index; i++) {
                      leftPercent += sceneSegments[i].widthPercent;
                    }
                    return (
                      <div
                        key={`label-${seg.index}`}
                        className="absolute bottom-full mb-1.5 text-[11px] font-medium truncate pointer-events-none"
                        style={{
                          left: `${leftPercent}%`,
                          width: `${seg.widthPercent}%`,
                          color: "#FFFFFF",
                          textAlign: "center",
                        }}
                      >
                        {seg.scene.label}
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-[2px] h-[5px] group-hover/progress:h-[10px] transition-all">
                    {sceneSegments.map((seg: any) => {
                      let segFill = 0;
                      if (currentTime >= seg.endTime) {
                        segFill = 100;
                      } else if (currentTime > seg.startTime) {
                        segFill =
                          ((currentTime - seg.startTime) / seg.scene.duration) *
                          100;
                      }
                      const isHovered = hoveredSegment === seg.index;

                      return (
                        <div
                          key={seg.scene.id}
                          className="relative h-full rounded-sm cursor-pointer transition-all"
                          style={{
                            width: `${seg.widthPercent}%`,
                            backgroundColor: "rgba(255,255,255,0.25)",
                            transform: isHovered ? "scaleY(1.4)" : "scaleY(1)",
                            transformOrigin: "bottom",
                          }}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                            const seekTime = seg.startTime + frac * (seg.endTime - seg.startTime);
                            setCurrentTime(seekTime);
                            setCurrentSceneIndex(seg.index);
                            if (videoElRef.current) {
                              videoElRef.current.currentTime = seekTime;
                            }
                          }}
                          onMouseEnter={() => setHoveredSegment(seg.index)}
                          onMouseLeave={() => setHoveredSegment(null)}
                        >
                          <div
                            className="absolute inset-y-0 left-0 rounded-sm"
                            style={{
                              width: `${segFill}%`,
                              backgroundColor:
                                seg.index === currentSceneIndex
                                  ? "#2563EB"
                                  : "#93B4F5",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePlayPause}
                    className="text-white hover:text-[#2563EB] transition-colors"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button className="text-white hover:text-[#2563EB] transition-colors">
                    <Volume2 size={20} />
                  </button>
                  <span className="text-white text-sm">
                    {formatTime(currentTime)} / {formatTime(effectiveDuration)}
                  </span>
                  <span className="text-white/50 text-sm">
                    {activeScenes[currentSceneIndex]?.label}
                  </span>
                  <div className="flex-1" />
                  <select
                    value={playbackSpeed}
                    onChange={(e) => {
                      const speed = Number(e.target.value);
                      setPlaybackSpeed(speed);
                      if (videoElRef.current) {
                        videoElRef.current.playbackRate = speed;
                      }
                    }}
                    className="bg-transparent text-white text-sm border border-white/30 rounded px-2 py-1"
                  >
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                  <button
                    onClick={handleFullscreen}
                    className="text-white hover:text-[#2563EB] transition-colors"
                  >
                    <Maximize size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Video metadata */}
            <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] mb-6">
              <h2
                className="mb-2"
                style={{ color: "#1A1A1A", fontSize: "20px", fontWeight: 600 }}
              >
                {video.title}
              </h2>
              <div
                className="flex items-center gap-4 mb-4 text-sm flex-wrap"
                style={{ color: "#6B7280" }}
              >
                <span>{video.authors.slice(0, 3).join(", ")}</span>
                <span>·</span>
                <span>
                  {video.venue} {video.year}
                </span>
                <span>·</span>
                <span>
                  Generated{" "}
                  {new Date(video.generatedAt).toLocaleDateString()}
                </span>
                <span>·</span>
                <span>{activeScenes.length} scenes</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {video.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(video.url, "_blank")}
                    className="gap-2"
                  >
                    <ExternalLink size={14} />
                    View Paper
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="gap-2"
                >
                  <Share2 size={14} />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const realJobId = video.realJobId || videoId;
                    window.open(getDownloadUrl(realJobId!), "_blank");
                  }}
                >
                  <Download size={14} />
                  Download
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <RefreshCw size={14} />
                  Regenerate
                </Button>
              </div>
            </div>
          </div>

          {/* Right panel — Paper/Notes */}
          {!isPanelCollapsed && (
            <div
              className="border-l border-[#E5E7EB] bg-white p-6 overflow-y-auto"
              style={{
                width: "35%",
                maxHeight: "calc(100vh - 72px)",
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as any)}
                >
                  <TabsList>
                    <TabsTrigger value="paper">
                      <FileText size={16} className="mr-2" />
                      Paper
                    </TabsTrigger>
                    <TabsTrigger value="notes">
                      <StickyNote size={16} className="mr-2" />
                      Notes {notes.length > 0 && `(${notes.length})`}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <button
                  onClick={() => setIsPanelCollapsed(true)}
                  className="p-2 hover:bg-[#F4F4F0] rounded-lg transition-colors"
                  style={{ color: "#6B7280" }}
                >
                  <X size={20} />
                </button>
              </div>

              {activeTab === "paper" && (
                <div className="space-y-6">
                  {currentSection && (
                    <div
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: "rgba(37, 99, 235, 0.05)" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: "#2563EB" }}
                        />
                        <span
                          className="text-sm"
                          style={{ color: "#2563EB", fontWeight: 500 }}
                        >
                          Currently viewing — {currentTemplateInfo.icon}{" "}
                          {currentTemplateInfo.label}
                        </span>
                      </div>
                      <h3
                        style={{ color: "#1A1A1A", fontWeight: 600 }}
                        className="mb-2"
                      >
                        {currentSection.title}
                      </h3>
                    </div>
                  )}

                  {video.sections?.map((section: any) => (
                    <div
                      key={section.id}
                      className="pb-6 border-b border-[#E5E7EB] last:border-0"
                    >
                      <h3
                        className="mb-3"
                        style={{
                          color: "#1A1A1A",
                          fontWeight: 600,
                          fontSize: "18px",
                        }}
                      >
                        {section.title}
                      </h3>
                      <p
                        className="leading-relaxed"
                        style={{
                          color: "#6B7280",
                          fontSize: "14px",
                        }}
                      >
                        {section.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "notes" && (
                <div className="space-y-4">
                  <Button
                    onClick={() => {
                      setNoteTimestamp(currentTime);
                      setIsAddingNote(true);
                      setIsPlaying(false);
                    }}
                    className="w-full gap-2"
                    style={{ backgroundColor: "#2563EB" }}
                  >
                    <StickyNote size={16} />
                    Add Note at {formatTime(currentTime)}
                  </Button>

                  {isAddingNote && (
                    <div
                      className="p-4 rounded-lg border-2"
                      style={{
                        borderColor: "#2563EB",
                        backgroundColor: "#FFFFFF",
                      }}
                    >
                      <div
                        className="mb-2 text-sm"
                        style={{ color: "#6B7280" }}
                      >
                        Note at {formatTime(noteTimestamp)} — Scene{" "}
                        {currentSceneIndex + 1}: {currentScene?.label}
                      </div>
                      <Textarea
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Type your note..."
                        className="mb-2"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleAddNote} size="sm">
                          Save
                        </Button>
                        <Button
                          onClick={() => {
                            setIsAddingNote(false);
                            setNewNoteText("");
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {notes.length === 0 && !isAddingNote && (
                    <div className="text-center py-12">
                      <StickyNote
                        size={48}
                        style={{ color: "#E5E7EB" }}
                        className="mx-auto mb-4"
                      />
                      <p style={{ color: "#6B7280" }}>
                        No notes yet. Press{" "}
                        <kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">
                          N
                        </kbd>{" "}
                        or click the button above to add your first note.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {notes.map((note: any) => (
                      <div
                        key={note.id}
                        className="p-4 rounded-lg border border-[#E5E7EB] hover:border-[#2563EB] transition-colors cursor-pointer group"
                        onClick={() => handleNoteClick(note.timestamp)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span
                            className="text-sm px-2 py-1 rounded"
                            style={{
                              backgroundColor: "#F4F4F0",
                              color: "#2563EB",
                              fontWeight: 500,
                            }}
                          >
                            {formatTime(note.timestamp)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                          >
                            <Trash2
                              size={14}
                              style={{ color: "#DC2626" }}
                            />
                          </button>
                        </div>
                        <p
                          style={{ color: "#1A1A1A", fontSize: "14px" }}
                        >
                          {note.text}
                        </p>
                        <p
                          className="text-xs mt-2"
                          style={{ color: "#9CA3AF" }}
                        >
                          {new Date(note.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Collapsed panel toggle */}
          {isPanelCollapsed && (
            <button
              onClick={() => setIsPanelCollapsed(false)}
              className="fixed right-8 top-24 p-3 bg-white rounded-lg border border-[#E5E7EB] hover:border-[#2563EB] transition-colors shadow-lg"
              style={{ color: "#1A1A1A" }}
            >
              <FileText size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts dismissable bar */}
      {!shortcutBarDismissed && !showShortcutsModal && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-white rounded-full border border-[#E5E7EB] shadow-lg text-sm z-40"
          style={{ color: "#6B7280" }}
        >
          <span>
            Press{" "}
            <kbd className="px-2 py-0.5 bg-[#F4F4F0] rounded text-xs font-medium">
              ?
            </kbd>{" "}
            for keyboard shortcuts
          </span>
          <button
            onClick={() => setShortcutBarDismissed(true)}
            className="p-1 hover:bg-[#F4F4F0] rounded-full transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Keyboard shortcuts modal */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 shadow-2xl border border-[#E5E7EB] max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span
                style={{ color: "#1A1A1A", fontWeight: 600, fontSize: "16px" }}
              >
                Keyboard Shortcuts
              </span>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 hover:bg-[#F4F4F0] rounded-lg transition-colors"
                style={{ color: "#6B7280" }}
              >
                <X size={18} />
              </button>
            </div>
            <div
              className="space-y-2 text-sm"
              style={{ color: "#6B7280" }}
            >
              <div className="flex items-center justify-between">
                <span>Play / Pause</span>
                <kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">
                  Space
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Previous / Next Scene</span>
                <kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">
                  ← →
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Add Note</span>
                <kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">
                  N
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Toggle Panel</span>
                <kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">
                  P
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Switch Tab</span>
                <kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">
                  T
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
