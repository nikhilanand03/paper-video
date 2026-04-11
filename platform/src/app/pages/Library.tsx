import { useNavigate } from "react-router";
import { useState, useEffect, useCallback } from "react";
import { Search, Play, Loader2 } from "lucide-react";
import { seedSampleItems } from "../lib/data";
import { examplePapers, mockPaperData } from "../lib/data";
import { getLibraryFromSupabase } from "../lib/supabaseVideos";
import { useAuth } from "../lib/useAuth";
import UserMenu from "../components/UserMenu";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Yesterday at ${timeStr}`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function Library() {
  const navigate = useNavigate();
  const { user, signInWithGoogle, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [library, setLibrary] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  // Build sample videos list from hardcoded data
  const sampleVideos = examplePapers.map((p) => {
    const data = mockPaperData[p.id];
    return {
      id: `sample_${p.id}`,
      title: p.title,
      authors: p.authors,
      venue: data?.venue || "",
      year: data?.year || 0,
      duration: p.duration || data?.duration || 0,
      blobUrl: p.blobUrl,
      realJobId: p.realJobId,
      arxivId: p.arxivId,
      isSample: true,
      generatedAt: new Date("2025-01-01").toISOString(),
    };
  });

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);

    if (user) {
      try {
        const cloudVideos = await getLibraryFromSupabase(user.id);
        const playableVideos = cloudVideos.filter((v: any) => v.blobUrl);
        const cloudIds = new Set(playableVideos.map((v: any) => v.id));
        const extraSamples = sampleVideos.filter((v) => !cloudIds.has(v.id));
        setLibrary([...playableVideos, ...extraSamples]);
      } catch {
        setLibrary(sampleVideos);
      }
    } else {
      setLibrary(sampleVideos);
    }
    setLibraryLoading(false);
  }, [user]);

  // Load on mount and when auth changes
  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  // Re-fetch when window regains focus (covers multi-tab and returning from background)
  useEffect(() => {
    const onFocus = () => loadLibrary();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadLibrary]);

  // Filter and sort by most recent
  const filteredVideos = library
    .filter((video: any) => {
      const query = searchQuery.toLowerCase();
      return (
        video.title.toLowerCase().includes(query) ||
        video.authors.some((author: string) =>
          author.toLowerCase().includes(query)
        )
      );
    })
    .sort(
      (a: any, b: any) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAF8" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between"
        style={{ padding: "20px 80px" }}
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5"
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              backgroundColor: "#2563EB",
              borderRadius: 8,
              color: "#fff",
              fontFamily: "'Source Serif 4', serif",
              fontSize: 18,
              fontWeight: 600,
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
        </button>

        <div className="flex items-center" style={{ gap: 28 }}>
          <button
            onClick={() => navigate("/library")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: "#1A1A1A",
            }}
          >
            Your videos
          </button>
          <a
            href="https://github.com/nikhilanand03/holi-hack"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: "#6B7280",
              textDecoration: "none",
            }}
          >
            GitHub
          </a>
          {user ? (
            <UserMenu user={user} signOut={signOut} />
          ) : (
            <button
              onClick={signInWithGoogle}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                fontWeight: 500,
                color: "#1A1A1A",
                padding: "8px 16px",
                border: "1px solid #D4D4D8",
                borderRadius: 8,
                background: "none",
                cursor: "pointer",
              }}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>

      {/* Header area */}
      <div
        className="flex items-start justify-between"
        style={{ padding: "40px 80px 0 80px" }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Source Serif 4', serif",
              fontSize: 32,
              color: "#1A1A1A",
              fontWeight: 400,
              margin: 0,
            }}
          >
            Your Videos
          </h1>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: "#9CA3AF",
              margin: "6px 0 0 0",
            }}
          >
            {user ? "Synced across your devices" : "Saved locally in this browser"}
          </p>
        </div>

        <div className="relative">
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9CA3AF",
            }}
          />
          <input
            type="text"
            placeholder="Search by title or author"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: 280,
              height: 40,
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              paddingLeft: 36,
              paddingRight: 12,
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: "#1A1A1A",
              outline: "none",
              backgroundColor: "#fff",
            }}
          />
        </div>
      </div>

      {/* Loading state */}
      {libraryLoading && (
        <div className="flex items-center justify-center" style={{ padding: "96px 80px" }}>
          <Loader2 size={28} color="#2563EB" className="animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!libraryLoading && filteredVideos.length === 0 && !searchQuery && (
        <div className="text-center" style={{ padding: "96px 80px" }}>
          <div
            className="flex items-center justify-center mx-auto"
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              backgroundColor: "#F4F4F0",
              marginBottom: 24,
            }}
          >
            <Play size={40} style={{ color: "#9CA3AF" }} />
          </div>
          <h2
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 24,
              color: "#1A1A1A",
              fontWeight: 600,
              margin: "0 0 16px 0",
            }}
          >
            Your video library is empty
          </h2>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: "#6B7280",
              margin: "0 0 24px 0",
            }}
          >
            Generate your first video from any research paper
          </p>
          <button
            onClick={() => navigate("/")}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
              backgroundColor: "#2563EB",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Generate Video
          </button>
        </div>
      )}

      {/* No search results */}
      {!libraryLoading && filteredVideos.length === 0 && searchQuery && (
        <div className="text-center" style={{ padding: "96px 80px" }}>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: "#6B7280",
            }}
          >
            No videos found matching "{searchQuery}"
          </p>
        </div>
      )}

      {/* Video cards */}
      {!libraryLoading && filteredVideos.length > 0 && (
        <div
          className="flex flex-wrap"
          style={{ padding: "32px 80px", gap: 24 }}
        >
          {filteredVideos.map((video: any) => (
            <div
              key={video.id}
              onClick={() =>
                navigate(
                  video.arxivId ? `/abs/${video.arxivId}` : `/v/${video.id}`
                )
              }
              className="group"
              style={{
                width: 380,
                backgroundColor: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                overflow: "hidden",
                cursor: "pointer",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#2563EB";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E5E7EB";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Thumbnail */}
              <div
                className="relative flex flex-col items-center justify-center"
                style={{
                  height: 200,
                  background: (() => {
                    // Rotate through warm, inviting gradients based on video index
                    const gradients = [
                      "linear-gradient(135deg, #4338ca 0%, #5b21b6 100%)",
                      "linear-gradient(135deg, #be185d 0%, #9f1239 100%)",
                      "linear-gradient(135deg, #1d4ed8 0%, #0e7490 100%)",
                      "linear-gradient(135deg, #15803d 0%, #0f766e 100%)",
                      "linear-gradient(135deg, #b91c1c 0%, #c2410c 100%)",
                      "linear-gradient(135deg, #6d28d9 0%, #7e22ce 100%)",
                      "linear-gradient(135deg, #c2410c 0%, #7c3aed 100%)",
                      "linear-gradient(135deg, #0369a1 0%, #4338ca 100%)",
                    ];
                    // Use title length as a simple hash for consistent color per video
                    const idx = (video.title?.length || 0) % gradients.length;
                    return gradients[idx];
                  })(),
                  padding: "0 40px",
                  overflow: "hidden",
                }}
              >
                {/* Subtle noise texture */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.2) 0%, transparent 50%)",
                  pointerEvents: "none",
                }} />

                {/* Accent bar */}
                <div
                  style={{
                    width: 40,
                    height: 3,
                    backgroundColor: "rgba(255,255,255,0.6)",
                    borderRadius: 2,
                    marginBottom: 16,
                    position: "relative",
                    zIndex: 1,
                  }}
                />
                <div
                  style={{
                    fontFamily: "'Source Serif 4', serif",
                    fontSize: 20,
                    color: "#FFFFFF",
                    textAlign: "center",
                    lineHeight: 1.35,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    position: "relative",
                    zIndex: 1,
                    maxWidth: "100%",
                    textShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                >
                  {video.title}
                </div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.7)",
                    marginTop: 10,
                    textAlign: "center",
                    position: "relative",
                    zIndex: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                  }}
                >
                  {(() => {
                    if (!video.authors?.length) return "";
                    const raw = video.authors[0];
                    const full = typeof raw === "string" ? raw : raw?.name || "";
                    if (!full) return "";
                    if (full.includes("et al")) return full;
                    // Split by comma to get first author, strip special chars
                    const firstAuthor = full.split(",")[0].replace(/[^\w\s.-]/g, "").trim();
                    const parts = firstAuthor.split(" ").filter(Boolean);
                    const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
                    return `${lastName} et al.`;
                  })()}
                </div>

                {/* Play icon overlay on hover */}
                <div
                  className="group-hover:opacity-100 opacity-0 transition-opacity"
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.15)",
                    zIndex: 2,
                  }}
                >
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(4px)",
                  }}>
                    <Play size={22} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 2 }} />
                  </div>
                </div>

                {/* Duration badge */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 10,
                    right: 10,
                    backgroundColor: "rgba(0,0,0,0.7)",
                    borderRadius: 4,
                    padding: "3px 8px",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 11,
                    color: "#FFFFFF",
                    zIndex: 3,
                  }}
                >
                  {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, "0")}
                </div>
              </div>

              {/* Info row */}
              <div
                className="flex items-start justify-between"
                style={{ padding: 16 }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#1A1A1A",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {video.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 12,
                      color: "#9CA3AF",
                      marginTop: 4,
                    }}
                  >
                    {timeAgo(video.generatedAt)}
                  </div>
                </div>
                <div
                  style={{
                    color: "#D1D5DB",
                    fontSize: 18,
                    letterSpacing: 1,
                    marginLeft: 12,
                    flexShrink: 0,
                    lineHeight: 1,
                    userSelect: "none",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  ···
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
