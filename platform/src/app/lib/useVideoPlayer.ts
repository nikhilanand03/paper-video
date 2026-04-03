/**
 * Custom hook encapsulating all video player state, data loading, and handlers.
 * Extracted from Viewer.tsx to keep the component focused on rendering.
 */

import { useState, useRef, useEffect } from "react";
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
} from "./data";
import { getStreamUrl, getDownloadUrl, getChapters, getJobData } from "./api";

export function useVideoPlayer(videoId?: string, arxivId?: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);

  // ── State ──────────────────────────────────────────────────────────────
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
  const [chapters, setChapters] = useState<{ start: number; duration: number }[] | null>(null);
  const [realScenes, setRealScenes] = useState<any[] | null>(null);

  // ── Video lookup ───────────────────────────────────────────────────────
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

  // ── Data loading effects ───────────────────────────────────────────────
  useEffect(() => {
    if (resolvedVideoId) {
      incrementViewCount(resolvedVideoId);
      setNotes(getNotes(resolvedVideoId));
    }
  }, [resolvedVideoId]);

  useEffect(() => {
    if (video?.realJobId) {
      getChapters(video.realJobId).then((ch) => {
        if (ch && ch.length > 0) setChapters(ch);
      });
      getJobData(video.realJobId)
        .then((data) => {
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
        })
        .catch(() => {});
    }
  }, [video?.realJobId]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────
  const effectiveDuration = realDuration ?? video?.duration ?? 0;

  const activeScenes =
    realScenes && chapters && realScenes.length === chapters.length
      ? realScenes
      : video?.scenes ?? [];

  const hasRealVideo = !!video?.realJobId || !!video?.blobUrl;
  const streamUrl = video?.blobUrl || (video?.realJobId ? getStreamUrl(video.realJobId) : null);

  const useRealChapters = chapters && chapters.length === activeScenes.length;
  const totalSceneDuration = useRealChapters
    ? chapters!.reduce((sum, ch) => sum + ch.duration, 0)
    : activeScenes.reduce((sum: number, s: any) => sum + s.duration, 0);

  const sceneSegments = activeScenes.map((scene: any, index: number) => {
    if (useRealChapters) {
      const ch = chapters![index];
      return { scene, index, startTime: ch.start, endTime: ch.start + ch.duration, widthPercent: (ch.duration / totalSceneDuration) * 100 };
    }
    let startTime = 0;
    for (let i = 0; i < index; i++) startTime += activeScenes[i].duration;
    return { scene, index, startTime, endTime: startTime + scene.duration, widthPercent: (scene.duration / totalSceneDuration) * 100 };
  });

  const currentScene = activeScenes[currentSceneIndex];
  const currentSection = video?.sections?.find((s: any) => s.id === currentScene?.sectionId);
  const currentTemplateInfo = templateInfo[currentScene?.type] || {
    label: currentScene?.type?.replace(/_/g, " "),
    icon: "📄",
  };
  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  // ── Playback simulation (demo mode) ───────────────────────────────────
  useEffect(() => {
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

  // ── Scene tracking ────────────────────────────────────────────────────
  useEffect(() => {
    if (sceneSegments.length > 0) {
      for (let i = sceneSegments.length - 1; i >= 0; i--) {
        if (currentTime >= sceneSegments[i].startTime) {
          setCurrentSceneIndex(i);
          break;
        }
      }
    }
  }, [currentTime, video, chapters]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (videoElRef.current) {
      videoElRef.current.paused ? videoElRef.current.play() : videoElRef.current.pause();
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleSceneClick = (index: number) => {
    if (sceneSegments[index]) {
      const time = sceneSegments[index].startTime;
      setCurrentTime(time);
      setCurrentSceneIndex(index);
      if (videoElRef.current) videoElRef.current.currentTime = time;
    }
  };

  const handlePreviousScene = () => {
    if (currentSceneIndex > 0) handleSceneClick(currentSceneIndex - 1);
  };

  const handleNextScene = () => {
    if (currentSceneIndex < activeScenes.length - 1) handleSceneClick(currentSceneIndex + 1);
  };

  const handleAddNote = () => {
    if (newNoteText.trim()) {
      saveNote(resolvedVideoId!, { timestamp: noteTimestamp, text: newNoteText });
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

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

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

  // ── Return ────────────────────────────────────────────────────────────
  return {
    // Refs
    containerRef,
    videoElRef,
    // Video data
    video,
    resolvedVideoId,
    activeScenes,
    currentScene,
    currentSection,
    currentTemplateInfo,
    sceneSegments,
    effectiveDuration,
    hasRealVideo,
    streamUrl,
    progress,
    // Playback
    isPlaying,
    currentTime,
    currentSceneIndex,
    playbackSpeed,
    // UI state
    isPanelCollapsed,
    activeTab,
    notes,
    isAddingNote,
    newNoteText,
    shortcutBarDismissed,
    showShortcutsModal,
    hoveredSegment,
    isFullscreen,
    noteTimestamp,
    // Handlers
    handlePlayPause,
    handleSceneClick,
    handlePreviousScene,
    handleNextScene,
    handleAddNote,
    handleDeleteNote,
    handleNoteClick,
    handleShare,
    handleFullscreen,
    formatTime,
    // Setters (for JSX bindings)
    setPlaybackSpeed,
    setHoveredSegment,
    setCurrentTime,
    setCurrentSceneIndex,
    setIsPanelCollapsed,
    setActiveTab,
    setIsAddingNote,
    setNewNoteText,
    setShortcutBarDismissed,
    setShowShortcutsModal,
    setNoteTimestamp,
    setIsPlaying,
    setRealDuration,
  };
}
