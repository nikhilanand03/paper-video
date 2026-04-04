import { useNavigate } from "react-router";
import { useState } from "react";
import { Search, Play } from "lucide-react";
import { getLibrary, seedSampleItems } from "../lib/data";
import { useAuth } from "../lib/useAuth";
import UserMenu from "../components/UserMenu";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Generated today";
  if (diffDays === 1) return "Generated 1 day ago";
  if (diffDays < 30) return `Generated ${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "Generated 1 month ago";
  return `Generated ${diffMonths} months ago`;
}

export default function Library() {
  const navigate = useNavigate();
  const { user, signInWithGoogle, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  seedSampleItems();
  const library = getLibrary();

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
            Saved locally in this browser
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

      {/* Empty state */}
      {filteredVideos.length === 0 && !searchQuery && (
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
      {filteredVideos.length === 0 && searchQuery && (
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
      {filteredVideos.length > 0 && (
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
                  height: 180,
                  backgroundColor: "#1A1A1A",
                  padding: "0 32px",
                }}
              >
                {/* Blue accent bar */}
                <div
                  style={{
                    width: 3,
                    height: 36,
                    backgroundColor: "#2563EB",
                    borderRadius: 2,
                    marginBottom: 12,
                  }}
                />
                <div
                  style={{
                    fontFamily: "'Source Serif 4', serif",
                    fontSize: 22,
                    color: "#fff",
                    textAlign: "center",
                    lineHeight: 1.3,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {video.title}
                </div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    color: "#6B7280",
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  {video.authors.slice(0, 2).join(", ")}
                  {video.authors.length > 2 &&
                    ` +${video.authors.length - 2} more`}
                </div>

                {/* Duration badge */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    borderRadius: 4,
                    padding: "2px 6px",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    color: "#fff",
                  }}
                >
                  {Math.floor(video.duration / 60)}:
                  {(video.duration % 60).toString().padStart(2, "0")}
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
