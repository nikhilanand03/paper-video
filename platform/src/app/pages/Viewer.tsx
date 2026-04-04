import { useParams, useNavigate } from "react-router";
import {
  Play, Pause, Volume2, Maximize, Minimize,
  Download, StickyNote, FileText, X, Trash2, Copy,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { getDownloadUrl } from "../lib/api";
import { useVideoPlayer } from "../lib/useVideoPlayer";

export default function Viewer() {
  const { videoId, arxivId } = useParams();
  const navigate = useNavigate();
  const p = useVideoPlayer(videoId, arxivId);

  if (!p.video) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FAFAF8" }}>
        <div className="text-center">
          <p style={{ color: "#1A1A1A" }} className="mb-4">Video not found</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const { video } = p;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FAFAF8" }}>
      {/* ── Nav bar ─────────────────────────────────────────────────────── */}
      <nav
        className="flex items-center justify-between bg-white shrink-0"
        style={{ padding: "16px 32px", borderBottom: "1px solid #F3F4F6" }}
      >
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div
            className="flex items-center justify-center rounded-md text-white font-semibold"
            style={{ width: 28, height: 28, backgroundColor: "#2563EB", fontSize: 15 }}
          >
            P
          </div>
          <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 19, fontWeight: 600, color: "#1A1A1A" }}>
            PaperVideo
          </span>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/")}
            className="hover:opacity-80 transition-opacity"
            style={{ color: "#2563EB", fontSize: 14, fontWeight: 500, fontFamily: "Inter, sans-serif" }}
          >
            Make your own
          </button>
          <button
            onClick={() => navigate("/library")}
            className="hover:opacity-80 transition-opacity"
            style={{ color: "#71717A", fontSize: 14, fontFamily: "Inter, sans-serif" }}
          >
            Your videos
          </button>
          <a
            href="https://github.com/nikhilanand03/holi-hack"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
            style={{ color: "#71717A", fontSize: 14, fontFamily: "Inter, sans-serif" }}
          >
            GitHub
          </a>
          <button
            className="transition-colors hover:bg-gray-50"
            style={{
              padding: "6px 16px",
              border: "1px solid #D4D4D8",
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 500,
              color: "#1A1A1A",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0" style={{ padding: "24px 32px", gap: 24 }}>
        {/* ── Left: video player ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={p.containerRef} className="relative flex flex-col" style={{ aspectRatio: "16/9" }}>
            {/* Video area — rounded top corners */}
            <div
              className="relative flex-1 overflow-hidden"
              style={{ backgroundColor: "#1A1A1A", borderRadius: "12px 12px 0 0" }}
            >
              {(() => { console.log("[RENDER] hasRealVideo:", p.hasRealVideo, "streamUrl:", p.streamUrl?.slice(0, 40)); return null; })()}
              {p.hasRealVideo && p.streamUrl ? (
                <video
                  ref={p.videoElRef}
                  src={p.streamUrl}
                  className="w-full h-full object-contain"
                  onTimeUpdate={() => { if (p.videoElRef.current) p.setCurrentTime(p.videoElRef.current.currentTime); }}
                  onSeeking={() => console.log("[VIDEO] seeking to:", p.videoElRef.current?.currentTime)}
                  onSeeked={() => console.log("[VIDEO] seeked, now at:", p.videoElRef.current?.currentTime)}
                  onError={(e) => console.warn("[VIDEO] error:", (e.target as HTMLVideoElement).error)}
                  onPlay={() => p.setIsPlaying(true)}
                  onPause={() => p.setIsPlaying(false)}
                  onEnded={() => p.setIsPlaying(false)}
                  onLoadedMetadata={() => { if (p.videoElRef.current) { console.log("[VIDEO] metadata loaded, duration:", p.videoElRef.current.duration, "seekable:", p.videoElRef.current.seekable.length > 0 ? `${p.videoElRef.current.seekable.start(0)}-${p.videoElRef.current.seekable.end(0)}` : "none"); p.setRealDuration(p.videoElRef.current.duration); } }}
                />
              ) : (
                /* Title card / scene preview */
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center px-12 max-w-4xl">
                    {/* Blue accent bar */}
                    <div
                      className="mx-auto mb-6"
                      style={{ width: 48, height: 4, borderRadius: 2, backgroundColor: "#2563EB" }}
                    />
                    <div style={{
                      fontFamily: "'Source Serif 4', serif",
                      fontSize: 40,
                      color: "#FFFFFF",
                      lineHeight: 1.2,
                      marginBottom: 16,
                    }}>
                      {p.currentScene?.type === "title_card" ? video.title : `Scene ${p.currentSceneIndex + 1}: ${p.currentScene?.label}`}
                    </div>
                    <div style={{
                      fontFamily: "Inter, sans-serif",
                      color: "#9CA3AF",
                      fontSize: 14,
                      lineHeight: 1.6,
                      maxWidth: 600,
                      margin: "0 auto",
                    }}>
                      {p.currentScene?.type === "title_card"
                        ? video.authors?.slice(0, 4).join(", ")
                        : p.currentScene?.narration}
                    </div>
                  </div>
                </div>
              )}

              {/* Play/Pause overlay */}
              <button
                onClick={p.handlePlayPause}
                className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
              >
                {p.isPlaying ? <Pause size={64} color="#FFFFFF" /> : <Play size={64} color="#FFFFFF" />}
              </button>
            </div>

            {/* ── Controls bar ─────────────────────────────────────────── */}
            <div style={{ backgroundColor: "#111111", borderRadius: "0 0 12px 12px", padding: "0 16px" }}>
              {/* Segmented chapter progress bar */}
              <div className="relative pt-3 pb-1 group/progress">
                {/* Hover tooltip */}
                {p.hoveredSegment !== null && p.hoverTime !== null && (() => {
                  const seg = p.sceneSegments[p.hoveredSegment];
                  const leftPercent = p.effectiveDuration > 0 ? (p.hoverTime / p.effectiveDuration) * 100 : 0;
                  return (
                    <div
                      className="absolute bottom-full mb-2 whitespace-nowrap px-2.5 py-1.5 rounded text-xs shadow-lg z-50 pointer-events-none -translate-x-1/2"
                      style={{ left: `${Math.min(Math.max(leftPercent, 4), 96)}%`, backgroundColor: "rgba(0,0,0,0.9)", color: "#FFFFFF" }}
                    >
                      <span className="font-medium">{seg.scene.label}</span>
                      <span className="ml-1.5 opacity-70">{p.formatTime(p.hoverTime)}</span>
                    </div>
                  );
                })()}

                <div className="flex items-center h-[4px] group-hover/progress:h-[8px] transition-all" style={{ gap: 2 }}>
                  {p.sceneSegments.map((seg: any) => {
                    let segFill = 0;
                    if (p.currentTime >= seg.endTime) segFill = 100;
                    else if (p.currentTime > seg.startTime) segFill = ((p.currentTime - seg.startTime) / (seg.endTime - seg.startTime)) * 100;
                    const isPlayed = p.currentTime >= seg.endTime;
                    const isActive = seg.index === p.currentSceneIndex;
                    return (
                      <div
                        key={seg.scene.id}
                        className="relative h-full rounded-sm cursor-pointer transition-all"
                        style={{
                          width: `${seg.widthPercent}%`,
                          backgroundColor: "#D4D4D8",
                          transform: p.hoveredSegment === seg.index ? "scaleY(1.4)" : "scaleY(1)",
                          transformOrigin: "bottom",
                        }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                          const seekTime = seg.startTime + frac * (seg.endTime - seg.startTime);
                          console.log("[SEEK DEBUG]", {
                            segIndex: seg.index,
                            frac,
                            seekTime,
                            segStart: seg.startTime,
                            segEnd: seg.endTime,
                            hasVideoEl: !!p.videoElRef.current,
                            videoCurrentTime: p.videoElRef.current?.currentTime,
                            videoDuration: p.videoElRef.current?.duration,
                            videoReadyState: p.videoElRef.current?.readyState,
                            videoSrc: p.videoElRef.current?.src?.slice(0, 80),
                          });
                          p.setCurrentTime(seekTime);
                          p.setCurrentSceneIndex(seg.index);
                          if (p.videoElRef.current) {
                            p.videoElRef.current.currentTime = seekTime;
                            console.log("[SEEK DEBUG] after set:", p.videoElRef.current.currentTime);
                          }
                        }}
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                          p.setHoverTime(seg.startTime + frac * (seg.endTime - seg.startTime));
                        }}
                        onMouseEnter={() => p.setHoveredSegment(seg.index)}
                        onMouseLeave={() => { p.setHoveredSegment(null); p.setHoverTime(null); }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-sm"
                          style={{
                            width: `${segFill}%`,
                            backgroundColor: (isActive || isPlayed) ? "#2563EB" : "transparent",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-3 pb-3 pt-1.5">
                {/* Play button in transparent circle */}
                <button
                  onClick={p.handlePlayPause}
                  className="flex items-center justify-center transition-colors hover:bg-white/10"
                  style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  {p.isPlaying
                    ? <Pause size={16} color="#FFFFFF" />
                    : <Play size={16} color="#FFFFFF" style={{ marginLeft: 1 }} />}
                </button>

                {/* Time */}
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                }}>
                  {p.formatTime(p.currentTime)} / {p.formatTime(p.effectiveDuration)}
                </span>

                <div className="flex-1" />

                {/* Speed selector */}
                <select
                  value={p.playbackSpeed}
                  onChange={(e) => {
                    const speed = Number(e.target.value);
                    p.setPlaybackSpeed(speed);
                    if (p.videoElRef.current) p.videoElRef.current.playbackRate = speed;
                  }}
                  className="bg-transparent text-white/70 text-xs border border-white/20 rounded px-2 py-1 cursor-pointer"
                  style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}
                >
                  <option value={1}>1x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>

                {/* Volume */}
                <button className="text-white/70 hover:text-white transition-colors">
                  <Volume2 size={18} />
                </button>

                {/* Fullscreen */}
                <button onClick={p.handleFullscreen} className="text-white/70 hover:text-white transition-colors">
                  {p.isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right sidebar ───────────────────────────────────────────── */}
        {!p.isPanelCollapsed && (
          <div
            className="flex flex-col overflow-hidden shrink-0"
            style={{
              width: 320,
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              maxHeight: "calc(100vh - 48px - 57px)",
            }}
          >
            {/* Paper metadata */}
            <div style={{ padding: "20px 20px 16px" }}>
              <h3 style={{
                fontFamily: "'Source Serif 4', serif",
                fontSize: 18,
                fontWeight: 600,
                color: "#1A1A1A",
                lineHeight: 1.3,
                marginBottom: 8,
              }}>
                {video.title}
              </h3>
              <p style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                color: "#6B7280",
                lineHeight: 1.4,
                marginBottom: 10,
              }}>
                {video.authors?.slice(0, 4).join(", ")}
              </p>
              <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 12, color: "#9CA3AF" }}>
                {video.venue && (
                  <span style={{
                    padding: "2px 10px",
                    borderRadius: 9999,
                    backgroundColor: "#EFF6FF",
                    color: "#2563EB",
                    fontSize: 11,
                    fontWeight: 500,
                  }}>
                    {video.venue}
                  </span>
                )}
                {video.year && <span>{video.year}</span>}
                <span style={{ color: "#D4D4D8" }}>|</span>
                <span>{p.formatTime(p.effectiveDuration)}</span>
              </div>
            </div>

            {/* Tab bar */}
            <div
              className="flex items-center shrink-0"
              style={{ borderBottom: "1px solid #F3F4F6", padding: "0 20px" }}
            >
              <button
                onClick={() => p.setActiveTab("paper")}
                className="relative transition-colors"
                style={{
                  padding: "10px 0",
                  marginRight: 20,
                  fontSize: 13,
                  fontWeight: p.activeTab === "paper" ? 600 : 400,
                  color: p.activeTab === "paper" ? "#2563EB" : "#71717A",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Chapters
                {p.activeTab === "paper" && (
                  <div className="absolute bottom-0 left-0 right-0" style={{ height: 2, backgroundColor: "#2563EB", borderRadius: 1 }} />
                )}
              </button>
              <button
                onClick={() => p.setActiveTab("notes")}
                className="relative transition-colors"
                style={{
                  padding: "10px 0",
                  marginRight: 20,
                  fontSize: 13,
                  fontWeight: p.activeTab === "notes" ? 600 : 400,
                  color: p.activeTab === "notes" ? "#2563EB" : "#71717A",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Notes{p.notes.length > 0 ? ` (${p.notes.length})` : ""}
                {p.activeTab === "notes" && (
                  <div className="absolute bottom-0 left-0 right-0" style={{ height: 2, backgroundColor: "#2563EB", borderRadius: 1 }} />
                )}
              </button>
              <div className="flex-1" />
              <button
                onClick={() => p.setIsPanelCollapsed(true)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                style={{ color: "#A1A1AA" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Tab content — scrollable */}
            <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0" }}>
              {p.activeTab === "paper" && (
                <div>
                  {p.activeScenes.map((scene: any, index: number) => {
                    const seg = p.sceneSegments[index];
                    const isActive = index === p.currentSceneIndex;
                    return (
                      <div
                        key={scene.id}
                        className="flex items-center gap-3 cursor-pointer transition-colors hover:bg-gray-50"
                        style={{
                          padding: "10px 20px",
                          backgroundColor: isActive ? "#F8FAFF" : "transparent",
                          borderLeft: isActive ? "3px solid #2563EB" : "3px solid transparent",
                          paddingLeft: isActive ? 17 : 20,
                        }}
                        onClick={() => {
                          if (seg) {
                            p.setCurrentTime(seg.startTime);
                            p.setCurrentSceneIndex(index);
                            if (p.videoElRef.current) p.videoElRef.current.currentTime = seg.startTime;
                          }
                        }}
                      >
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 12,
                          color: isActive ? "#2563EB" : "#A1A1AA",
                          width: 36,
                          flexShrink: 0,
                        }}>
                          {seg ? p.formatTime(seg.startTime) : ""}
                        </span>
                        <span style={{
                          fontSize: 14,
                          color: isActive ? "#2563EB" : "#3F3F46",
                          fontWeight: isActive ? 500 : 400,
                          fontFamily: "Inter, sans-serif",
                        }}>
                          {scene.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {p.activeTab === "notes" && (
                <div style={{ padding: "8px 20px" }} className="space-y-4">
                  <Button
                    onClick={() => { p.setNoteTimestamp(p.currentTime); p.setIsAddingNote(true); p.setIsPlaying(false); }}
                    className="w-full gap-2"
                    style={{ backgroundColor: "#2563EB" }}
                  >
                    <StickyNote size={16} />Add Note at {p.formatTime(p.currentTime)}
                  </Button>

                  {p.notes.length > 0 && (
                    <Button onClick={p.handleExportNotes} variant="outline" className="w-full gap-2">
                      <Download size={16} />Export Notes (.md)
                    </Button>
                  )}

                  {p.isAddingNote && (
                    <div className="p-4 rounded-lg border-2" style={{ borderColor: "#2563EB", backgroundColor: "#FFFFFF" }}>
                      <div className="mb-2 text-sm" style={{ color: "#6B7280" }}>
                        Note at {p.formatTime(p.noteTimestamp)} — Ch. {p.currentSceneIndex + 1}: {p.currentScene?.label}
                      </div>
                      <Textarea
                        value={p.newNoteText}
                        onChange={(e) => p.setNewNoteText(e.target.value)}
                        placeholder="Type your note..."
                        className="mb-2"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button onClick={p.handleAddNote} size="sm">Save</Button>
                        <Button onClick={() => { p.setIsAddingNote(false); p.setNewNoteText(""); }} variant="outline" size="sm">Cancel</Button>
                      </div>
                    </div>
                  )}

                  {p.notes.length === 0 && !p.isAddingNote && (
                    <div className="text-center py-12">
                      <StickyNote size={48} style={{ color: "#E5E7EB" }} className="mx-auto mb-4" />
                      <p style={{ color: "#6B7280", fontSize: 13 }}>
                        No notes yet. Press <kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">N</kbd> or click above to add one.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {p.notes.map((note: any) => (
                      <div
                        key={note.id}
                        className="p-4 rounded-lg border border-[#E5E7EB] hover:border-[#2563EB] transition-colors cursor-pointer group"
                        onClick={() => p.handleNoteClick(note.timestamp)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm px-2 py-1 rounded" style={{ backgroundColor: "#F4F4F0", color: "#2563EB", fontWeight: 500 }}>
                            {p.formatTime(note.timestamp)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); p.handleDeleteNote(note.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} style={{ color: "#DC2626" }} />
                          </button>
                        </div>
                        <p style={{ color: "#1A1A1A", fontSize: 14 }}>{note.text}</p>
                        <p className="text-xs mt-2" style={{ color: "#9CA3AF" }}>{new Date(note.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="shrink-0" style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6" }}>
              <div className="flex gap-2">
                <button
                  onClick={() => window.open(getDownloadUrl(video.realJobId || videoId!), "_blank")}
                  className="flex-1 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{
                    height: 38,
                    borderRadius: 8,
                    backgroundColor: "#1A1A1A",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  onClick={p.handleShare}
                  className="flex-1 flex items-center justify-center gap-2 transition-colors hover:bg-gray-50"
                  style={{
                    height: 38,
                    borderRadius: 8,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    color: "#3F3F46",
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <Copy size={14} />
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed state: expand button */}
        {p.isPanelCollapsed && (
          <button
            onClick={() => p.setIsPanelCollapsed(false)}
            className="self-start shrink-0 flex items-center justify-center bg-white hover:border-[#2563EB] transition-colors shadow-sm"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              color: "#3F3F46",
            }}
          >
            <FileText size={20} />
          </button>
        )}
      </div>

      {/* ── Export reminder ──────────────────────────────────────────── */}
      {p.showExportReminder && (
        <div className="fixed bottom-20 right-8 z-50 bg-white rounded-xl border border-[#E5E7EB] shadow-lg p-4 max-w-xs">
          <div className="flex items-start gap-3">
            <StickyNote size={20} style={{ color: "#2563EB" }} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: "#1A1A1A" }}>Export your notes</p>
              <p className="text-xs mb-3" style={{ color: "#6B7280" }}>
                Use the export button to save your notes as a Markdown file before you leave.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={p.handleExportNotes} className="gap-1.5" style={{ backgroundColor: "#2563EB" }}>
                  <Download size={14} />Export
                </Button>
                <Button size="sm" variant="outline" onClick={() => p.setExportReminderDismissed(true)}>Dismiss</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Shortcut hint bar ───────────────────────────────────────── */}
      {!p.shortcutBarDismissed && !p.showShortcutsModal && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-white rounded-full border border-[#E5E7EB] shadow-lg text-sm z-40"
          style={{ color: "#6B7280" }}
        >
          <span>
            Press <kbd className="px-2 py-0.5 bg-[#F4F4F0] rounded text-xs font-medium">?</kbd> for keyboard shortcuts
          </span>
          <button onClick={() => p.setShortcutBarDismissed(true)} className="p-1 hover:bg-[#F4F4F0] rounded-full transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Shortcuts modal ─────────────────────────────────────────── */}
      {p.showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => p.setShowShortcutsModal(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl border border-[#E5E7EB] max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span style={{ color: "#1A1A1A", fontWeight: 600, fontSize: 16 }}>Keyboard Shortcuts</span>
              <button onClick={() => p.setShowShortcutsModal(false)} className="p-1 hover:bg-[#F4F4F0] rounded-lg transition-colors" style={{ color: "#6B7280" }}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-sm" style={{ color: "#6B7280" }}>
              {[
                ["Play / Pause", "Space"],
                ["Previous / Next Chapter", "\u2190 \u2192"],
                ["Add Note", "N"],
                ["Toggle Panel", "P"],
                ["Switch Tab", "T"],
                ["Export Notes", "E"],
                ["Fullscreen", "F"],
              ].map(([label, key]) => (
                <div key={label} className="flex items-center justify-between">
                  <span>{label}</span>
                  <kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
