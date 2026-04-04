import { useParams, useNavigate } from "react-router";
import {
  Play, Pause, Volume2, Maximize, ExternalLink,
  Share2, Download, RefreshCw, StickyNote, FileText, X, Trash2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
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
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAF8" }}>
      {/* Top bar */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="max-w-[1920px] mx-auto px-8 py-4 flex items-center justify-between">
          <div style={{ fontFamily: "'Instrument Serif', serif" }} className="text-2xl cursor-pointer" onClick={() => navigate("/")}>
            PaperVideo
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/library")} className="text-[#6B7280] hover:text-[#1A1A1A] transition-colors">Library</button>
            <button className="text-[#6B7280] hover:text-[#1A1A1A] transition-colors">Sign In</button>
          </div>
        </div>
      </div>

      {/* Main viewer */}
      <div className="max-w-[1920px] mx-auto">
        <div className="flex">
          {/* Left panel — Video player */}
          <div className="flex-1 p-8 transition-all" style={{ width: p.isPanelCollapsed ? "100%" : "65%" }}>
            <div ref={p.containerRef} className="relative rounded-2xl overflow-hidden mb-8" style={{ backgroundColor: "#1A1A1A", aspectRatio: "16/9" }}>
              {p.hasRealVideo && p.streamUrl ? (
                <video
                  ref={p.videoElRef}
                  src={p.streamUrl}
                  preload="auto"
                  crossOrigin="anonymous"
                  className="absolute inset-0 w-full h-full object-contain cursor-pointer z-0"
                  onClick={p.handlePlayPause}
                  onTimeUpdate={() => { if (p.videoElRef.current) p.setCurrentTime(p.videoElRef.current.currentTime); }}
                  onPlay={() => p.setIsPlaying(true)}
                  onPause={() => p.setIsPlaying(false)}
                  onEnded={() => p.setIsPlaying(false)}
                  onLoadedMetadata={() => { if (p.videoElRef.current) p.setRealDuration(p.videoElRef.current.duration); }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={p.handlePlayPause}>
                  <div className="text-center p-12 max-w-4xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6" style={{ backgroundColor: "rgba(37, 99, 235, 0.2)", color: "#93B4F5", fontSize: "14px" }}>
                      <span>{p.currentTemplateInfo.icon}</span>
                      <span>{p.currentTemplateInfo.label}</span>
                    </div>
                    <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "42px", color: "#FFFFFF", marginBottom: "16px", lineHeight: 1.2 }}>
                      {p.currentScene?.type === "title_card" ? video.title : `Scene ${p.currentSceneIndex + 1}: ${p.currentScene?.label}`}
                    </div>
                    <div style={{ color: "#9CA3AF", fontSize: "18px", lineHeight: 1.6, maxWidth: "700px", margin: "0 auto" }}>
                      {p.currentScene?.narration}
                    </div>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div
                className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-3 pt-16"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Seek bar - single div, simple math */}
                <div
                  className="relative h-8 flex items-end mb-2 cursor-pointer group/bar"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const frac = (e.clientX - rect.left) / rect.width;
                    const t = Math.max(0, Math.min(1, frac)) * p.effectiveDuration;
                    if (p.videoElRef.current) {
                      p.videoElRef.current.currentTime = t;
                      if (p.videoElRef.current.paused) p.videoElRef.current.play();
                    }
                    p.setCurrentTime(t);
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const frac = (e.clientX - rect.left) / rect.width;
                    const t = Math.max(0, Math.min(1, frac)) * p.effectiveDuration;
                    p.setHoverTime(t);
                    const seg = p.sceneSegments.find((s: any) => t >= s.startTime && t < s.endTime) || p.sceneSegments[p.sceneSegments.length - 1];
                    if (seg) p.setHoveredSegment(seg.index);
                  }}
                  onMouseLeave={() => { p.setHoveredSegment(null); p.setHoverTime(null); }}
                >
                  {/* Hover tooltip */}
                  {p.hoveredSegment !== null && p.hoverTime !== null && (() => {
                    const seg = p.sceneSegments[p.hoveredSegment];
                    const leftPct = (p.hoverTime / p.effectiveDuration) * 100;
                    return (
                      <div className="absolute bottom-full mb-2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1.5 rounded text-xs shadow-lg pointer-events-none"
                        style={{ left: `${Math.min(Math.max(leftPct, 5), 95)}%`, backgroundColor: "rgba(0,0,0,0.9)", color: "#fff" }}>
                        <span className="font-medium">{seg.scene.label}</span>
                        <span className="ml-1.5 opacity-60">{p.formatTime(p.hoverTime)}</span>
                      </div>
                    );
                  })()}
                  {/* Current scene label (when not hovering) */}
                  {p.hoveredSegment === null && p.sceneSegments.map((seg: any) => {
                    if (seg.index !== p.currentSceneIndex) return null;
                    let left = 0;
                    for (let i = 0; i < seg.index; i++) left += p.sceneSegments[i].widthPercent;
                    return (
                      <div key={`lbl-${seg.index}`} className="absolute bottom-full mb-1.5 text-[11px] font-medium truncate pointer-events-none"
                        style={{ left: `${left}%`, width: `${seg.widthPercent}%`, color: "#fff", textAlign: "center" }}>
                        {seg.scene.label}
                      </div>
                    );
                  })}
                  {/* Segments bar */}
                  <div className="flex items-center gap-[2px] w-full h-[6px] group-hover/bar:h-[10px] transition-all pointer-events-none">
                    {p.sceneSegments.map((seg: any) => {
                      let fill = 0;
                      if (p.currentTime >= seg.endTime) fill = 100;
                      else if (p.currentTime > seg.startTime) fill = ((p.currentTime - seg.startTime) / (seg.endTime - seg.startTime)) * 100;
                      return (
                        <div key={seg.scene.id} className="relative h-full rounded-sm transition-transform"
                          style={{ width: `${seg.widthPercent}%`, backgroundColor: "rgba(255,255,255,0.25)", transform: p.hoveredSegment === seg.index ? "scaleY(1.6)" : "scaleY(1)", transformOrigin: "bottom" }}>
                          <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${fill}%`, backgroundColor: seg.index === p.currentSceneIndex ? "#2563EB" : "#93B4F5" }} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button onClick={p.handlePlayPause} className="text-white hover:text-[#2563EB] transition-colors">
                    {p.isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button className="text-white hover:text-[#2563EB] transition-colors"><Volume2 size={20} /></button>
                  <span className="text-white text-sm">{p.formatTime(p.currentTime)} / {p.formatTime(p.effectiveDuration)}</span>
                  <span className="text-white/50 text-sm">{p.activeScenes[p.currentSceneIndex]?.label}</span>
                  <div className="flex-1" />
                  <select value={p.playbackSpeed} onChange={(e) => { const speed = Number(e.target.value); p.setPlaybackSpeed(speed); if (p.videoElRef.current) p.videoElRef.current.playbackRate = speed; }}
                    className="bg-transparent text-white text-sm border border-white/30 rounded px-2 py-1">
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                  <button onClick={p.handleFullscreen} className="text-white hover:text-[#2563EB] transition-colors"><Maximize size={20} /></button>
                </div>
              </div>
            </div>

            {/* Video metadata */}
            <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] mb-6">
              <h2 className="mb-2" style={{ color: "#1A1A1A", fontSize: "20px", fontWeight: 600 }}>{video.title}</h2>
              <div className="flex items-center gap-4 mb-4 text-sm flex-wrap" style={{ color: "#6B7280" }}>
                <span>{video.authors.slice(0, 3).join(", ")}</span>
                <span>·</span>
                <span>{video.venue}{video.year && !video.venue?.includes(String(video.year)) ? ` ${video.year}` : ''}</span>
                <span>·</span>
                <span>Generated {new Date(video.generatedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {video.url && <Button variant="outline" size="sm" onClick={() => window.open(video.url, "_blank")} className="gap-2"><ExternalLink size={14} />View Paper</Button>}
                <Button variant="outline" size="sm" onClick={p.handleShare} className="gap-2"><Share2 size={14} />Share</Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(getDownloadUrl(video.realJobId || videoId!), "_blank")}><Download size={14} />Download</Button>
                <Button variant="outline" size="sm" className="gap-2"><RefreshCw size={14} />Regenerate</Button>
              </div>
            </div>
          </div>

          {/* Right panel — Paper/Notes */}
          {!p.isPanelCollapsed && (
            <div className="border-l border-[#E5E7EB] bg-white p-6 overflow-y-auto" style={{ width: "35%", maxHeight: "calc(100vh - 72px)" }}>
              <div className="flex items-center justify-between mb-6">
                <Tabs value={p.activeTab} onValueChange={(v) => p.setActiveTab(v as any)}>
                  <TabsList>
                    <TabsTrigger value="paper"><FileText size={16} className="mr-2" />Paper</TabsTrigger>
                    <TabsTrigger value="notes"><StickyNote size={16} className="mr-2" />Notes {p.notes.length > 0 && `(${p.notes.length})`}</TabsTrigger>
                  </TabsList>
                </Tabs>
                <button onClick={() => p.setIsPanelCollapsed(true)} className="p-2 hover:bg-[#F4F4F0] rounded-lg transition-colors" style={{ color: "#6B7280" }}><X size={20} /></button>
              </div>

              {p.activeTab === "paper" && (
                <div className="space-y-6">
                  {p.currentSection && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: "rgba(37, 99, 235, 0.05)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#2563EB" }} />
                        <span className="text-sm" style={{ color: "#2563EB", fontWeight: 500 }}>Currently viewing — {p.currentTemplateInfo.icon} {p.currentTemplateInfo.label}</span>
                      </div>
                      <h3 style={{ color: "#1A1A1A", fontWeight: 600 }} className="mb-2">{p.currentSection.title}</h3>
                    </div>
                  )}
                  {video.sections?.map((section: any) => (
                    <div key={section.id} className="pb-6 border-b border-[#E5E7EB] last:border-0">
                      <h3 className="mb-3" style={{ color: "#1A1A1A", fontWeight: 600, fontSize: "18px" }}>{section.title}</h3>
                      <p className="leading-relaxed" style={{ color: "#6B7280", fontSize: "14px" }}>{section.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {p.activeTab === "notes" && (
                <div className="space-y-4">
                  <Button onClick={() => { p.setNoteTimestamp(p.currentTime); p.setIsAddingNote(true); p.setIsPlaying(false); }} className="w-full gap-2" style={{ backgroundColor: "#2563EB" }}>
                    <StickyNote size={16} />Add Note at {p.formatTime(p.currentTime)}
                  </Button>

                  {p.notes.length > 0 && (
                    <Button onClick={p.handleExportNotes} variant="outline" className="w-full gap-2">
                      <Download size={16} />Export Notes (.md)
                    </Button>
                  )}

                  {p.isAddingNote && (
                    <div className="p-4 rounded-lg border-2" style={{ borderColor: "#2563EB", backgroundColor: "#FFFFFF" }}>
                      <div className="mb-2 text-sm" style={{ color: "#6B7280" }}>Note at {p.formatTime(p.noteTimestamp)} — Scene {p.currentSceneIndex + 1}: {p.currentScene?.label}</div>
                      <Textarea value={p.newNoteText} onChange={(e) => p.setNewNoteText(e.target.value)} placeholder="Type your note..." className="mb-2" autoFocus />
                      <div className="flex gap-2">
                        <Button onClick={p.handleAddNote} size="sm">Save</Button>
                        <Button onClick={() => { p.setIsAddingNote(false); p.setNewNoteText(""); }} variant="outline" size="sm">Cancel</Button>
                      </div>
                    </div>
                  )}

                  {p.notes.length === 0 && !p.isAddingNote && (
                    <div className="text-center py-12">
                      <StickyNote size={48} style={{ color: "#E5E7EB" }} className="mx-auto mb-4" />
                      <p style={{ color: "#6B7280" }}>No notes yet. Press <kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">N</kbd> or click the button above to add your first note.</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {p.notes.map((note: any) => (
                      <div key={note.id} className="p-4 rounded-lg border border-[#E5E7EB] hover:border-[#2563EB] transition-colors cursor-pointer group" onClick={() => p.handleNoteClick(note.timestamp)}>
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm px-2 py-1 rounded" style={{ backgroundColor: "#F4F4F0", color: "#2563EB", fontWeight: 500 }}>{p.formatTime(note.timestamp)}</span>
                          <button onClick={(e) => { e.stopPropagation(); p.handleDeleteNote(note.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded">
                            <Trash2 size={14} style={{ color: "#DC2626" }} />
                          </button>
                        </div>
                        <p style={{ color: "#1A1A1A", fontSize: "14px" }}>{note.text}</p>
                        <p className="text-xs mt-2" style={{ color: "#9CA3AF" }}>{new Date(note.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {p.isPanelCollapsed && (
            <button onClick={() => p.setIsPanelCollapsed(false)} className="fixed right-8 top-24 p-3 bg-white rounded-lg border border-[#E5E7EB] hover:border-[#2563EB] transition-colors shadow-lg" style={{ color: "#1A1A1A" }}>
              <FileText size={20} />
            </button>
          )}
        </div>
      </div>

      {p.showExportReminder && (
        <div className="fixed bottom-20 right-8 z-50 bg-white rounded-xl border border-[#E5E7EB] shadow-lg p-4 max-w-xs">
          <div className="flex items-start gap-3">
            <StickyNote size={20} style={{ color: "#2563EB" }} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: "#1A1A1A" }}>Export your notes</p>
              <p className="text-xs mb-3" style={{ color: "#6B7280" }}>Use the export button to save your notes as a Markdown file before you leave.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={p.handleExportNotes} className="gap-1.5" style={{ backgroundColor: "#2563EB" }}><Download size={14} />Export</Button>
                <Button size="sm" variant="outline" onClick={() => p.setExportReminderDismissed(true)}>Dismiss</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!p.shortcutBarDismissed && !p.showShortcutsModal && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-white rounded-full border border-[#E5E7EB] shadow-lg text-sm z-40" style={{ color: "#6B7280" }}>
          <span>Press <kbd className="px-2 py-0.5 bg-[#F4F4F0] rounded text-xs font-medium">?</kbd> for keyboard shortcuts</span>
          <button onClick={() => p.setShortcutBarDismissed(true)} className="p-1 hover:bg-[#F4F4F0] rounded-full transition-colors"><X size={14} /></button>
        </div>
      )}

      {p.showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => p.setShowShortcutsModal(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl border border-[#E5E7EB] max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span style={{ color: "#1A1A1A", fontWeight: 600, fontSize: "16px" }}>Keyboard Shortcuts</span>
              <button onClick={() => p.setShowShortcutsModal(false)} className="p-1 hover:bg-[#F4F4F0] rounded-lg transition-colors" style={{ color: "#6B7280" }}><X size={18} /></button>
            </div>
            <div className="space-y-2 text-sm" style={{ color: "#6B7280" }}>
              <div className="flex items-center justify-between"><span>Play / Pause</span><kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">Space</kbd></div>
              <div className="flex items-center justify-between"><span>Previous / Next Scene</span><kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">&larr; &rarr;</kbd></div>
              <div className="flex items-center justify-between"><span>Add Note</span><kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">N</kbd></div>
              <div className="flex items-center justify-between"><span>Toggle Panel</span><kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">P</kbd></div>
              <div className="flex items-center justify-between"><span>Switch Tab</span><kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">T</kbd></div>
              <div className="flex items-center justify-between"><span>Export Notes</span><kbd className="px-2 py-1 bg-[#F4F4F0] rounded text-xs">E</kbd></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
