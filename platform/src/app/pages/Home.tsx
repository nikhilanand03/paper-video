import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Loader2, CheckCircle2 } from "lucide-react";
import { examplePapers, getOrCreateVideoId, seedSampleItems } from "../lib/data";
import { uploadPdf } from "../lib/api";
import { useAuth } from "../lib/useAuth";

export default function Home() {
  const navigate = useNavigate();
  const { user, signInWithGoogle, signOut } = useAuth();
  seedSampleItems();
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      setUrl("");
      setError(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUrl("");
      setError(null);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    if (e.target.value) {
      setFile(null);
    }
    setError(null);
  };

  const handleGenerate = async () => {
    setError(null);

    if (file) {
      setIsUploading(true);
      try {
        const jobId = await uploadPdf(file);
        navigate(`/video/${jobId}?source=upload&name=${encodeURIComponent(file.name)}`);
      } catch (err: any) {
        console.warn("Backend not available, using demo mode:", err.message);
        const jobId = getOrCreateVideoId("upload_" + Date.now());
        navigate(
          `/video/${jobId}?source=upload&name=${encodeURIComponent(file.name)}&demo=1`
        );
      } finally {
        setIsUploading(false);
      }
    } else if (url) {
      const jobId = getOrCreateVideoId("url_" + Date.now());
      navigate(
        `/video/${jobId}?source=url&url=${encodeURIComponent(url)}&demo=1`
      );
    }
  };

  const handleExampleClick = (paperId: string) => {
    const paper = examplePapers.find((p) => p.id === paperId);
    if (paper?.arxivId) {
      navigate(`/abs/${paper.arxivId}`);
    } else {
      const jobId = getOrCreateVideoId(paperId);
      navigate(`/video/${jobId}?paperId=${paperId}`);
    }
  };

  const canGenerate = (file || url.length > 0) && !isUploading;

  return (
    <div style={{ backgroundColor: "#FAFAF8", minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBlock: 20, paddingInline: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("/")}>
          <div style={{ width: 32, height: 32, backgroundColor: "#2563EB", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#FFFFFF", fontFamily: "'Source Serif 4', serif", fontSize: 18, lineHeight: "22px" }}>P</span>
          </div>
          <span style={{ color: "#1A1A1A", fontFamily: "'Source Serif 4', serif", fontSize: 22, lineHeight: "28px" }}>PaperVideo</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <button onClick={() => navigate("/library")} style={{ background: "none", border: "none", cursor: "pointer", color: "#71717A", fontFamily: "'Inter', sans-serif", fontSize: 14, lineHeight: "18px", padding: 0 }}>Your videos</button>
          <a href="https://github.com/nikhilanand03/holi-hack" target="_blank" rel="noopener noreferrer" style={{ color: "#71717A", fontFamily: "'Inter', sans-serif", fontSize: 14, lineHeight: "18px", textDecoration: "none" }}>GitHub</a>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px 4px 4px", border: "1px solid #E4E4E7", borderRadius: 20, cursor: "pointer" }} onClick={signOut}>
              <div style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#4F6EF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#FFFFFF", fontWeight: 600 }}>
                  {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                </span>
              </div>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#1A1A1A", fontWeight: 500 }}>
                {user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "User"}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #D4D4D8", borderRadius: 8, paddingBlock: 8, paddingInline: 16, cursor: "pointer" }} onClick={signInWithGoogle}>
              <span style={{ color: "#1A1A1A", fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, lineHeight: "18px" }}>Sign in</span>
            </div>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingLeft: 80, paddingRight: 80, paddingTop: 48 }}>
        <span style={{ color: "#7C3AED", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, letterSpacing: "1.5px", lineHeight: "16px", textTransform: "uppercase" as const }}>Open Source</span>
        <span style={{ color: "#1A1A1A", fontFamily: "'Source Serif 4', serif", fontSize: 56, lineHeight: 1.15, textAlign: "center" }}>Turn research into video</span>
        <span style={{ color: "#6B7280", fontFamily: "'Inter', sans-serif", fontSize: 18, lineHeight: 1.6, maxWidth: 520, textAlign: "center" }}>Upload a PDF or paste an arXiv URL. Get a narrated, animated video in minutes — no editing required.</span>
      </div>

      {/* PDF → Video visual */}
      <div style={{ display: "flex", alignItems: "center", gap: 40, justifyContent: "center", paddingBlock: 40, paddingInline: 80 }}>
        {/* PDF card */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", flexShrink: 0, gap: 14, height: 280, paddingBlock: 28, paddingInline: 32, width: 400 }}>
            <div style={{ backgroundColor: "#1A1A1A", borderRadius: 2, height: 10, width: 180 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ backgroundColor: "#9CA3AF", borderRadius: 2, height: 6, width: 60 }} />
              <div style={{ backgroundColor: "#9CA3AF", borderRadius: 2, height: 6, width: 40 }} />
              <div style={{ backgroundColor: "#9CA3AF", borderRadius: 2, height: 6, width: 50 }} />
            </div>
            <div style={{ backgroundColor: "#E5E7EB", height: 1, width: "100%" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ backgroundColor: "#E5E7EB", borderRadius: 2, height: 6, width: "100%" }} />
              <div style={{ backgroundColor: "#E5E7EB", borderRadius: 2, height: 6, width: "95%" }} />
              <div style={{ backgroundColor: "#E5E7EB", borderRadius: 2, height: 6, width: "88%" }} />
              <div style={{ backgroundColor: "#E5E7EB", borderRadius: 2, height: 6, width: "92%" }} />
            </div>
            <div style={{ backgroundColor: "#1A1A1A", borderRadius: 2, height: 8, width: 140 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ backgroundColor: "#E5E7EB", borderRadius: 2, height: 6, width: "100%" }} />
              <div style={{ backgroundColor: "#E5E7EB", borderRadius: 2, height: 6, width: "90%" }} />
              <div style={{ backgroundColor: "#E5E7EB", borderRadius: 2, height: 6, width: "96%" }} />
            </div>
          </div>
          <span style={{ color: "#9CA3AF", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, lineHeight: "16px" }}>Your PDF</span>
        </div>

        {/* Arrow */}
        <div style={{ width: 48, height: 48, backgroundColor: "#2563EB", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 600, lineHeight: "24px" }}>→</span>
        </div>

        {/* Video card */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ backgroundColor: "#1A1A1A", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", flexShrink: 0, height: 280, justifyContent: "center", overflow: "clip", position: "relative" as const, width: 400 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 32 }}>
              <div style={{ backgroundColor: "#2563EB", borderRadius: 2, height: 4, width: 48 }} />
              <span style={{ color: "#FAFAF8", fontFamily: "'Source Serif 4', serif", fontSize: 28, lineHeight: "34px", textAlign: "center", whiteSpace: "pre-wrap" as const }}>{"Attention Is All\nYou Need"}</span>
              <span style={{ color: "#9CA3AF", fontFamily: "'Inter', sans-serif", fontSize: 12, lineHeight: "16px", textAlign: "center" }}>Vaswani et al. · NeurIPS 2017</span>
            </div>
            <div style={{ position: "absolute" as const, bottom: 16, left: 16, right: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#FFFFFF", fontSize: 12 }}>▶</span>
              </div>
              <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, height: 3 }}>
                <div style={{ backgroundColor: "#2563EB", borderRadius: 2, height: 3, width: "35%" }} />
              </div>
              <span style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Inter', sans-serif", fontSize: 11, lineHeight: "14px" }}>2:34 / 7:12</span>
            </div>
          </div>
          <span style={{ color: "#9CA3AF", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, lineHeight: "16px" }}>Narrated Video</span>
        </div>
      </div>

      {/* Upload area — everything inside the dashed border */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingInline: 80, paddingTop: 8 }}>
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
            backgroundColor: isDragging ? "rgba(37, 99, 235, 0.04)" : file ? "rgba(22, 163, 74, 0.03)" : "#FFFFFF",
            border: `2px dashed ${isDragging ? "#2563EB" : file ? "#16A34A" : "#D1D5DB"}`,
            borderRadius: 16, paddingBlock: 36, paddingInline: 36, width: 640,
            cursor: "pointer", transition: "border-color 0.2s, background-color 0.2s",
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? (
            <>
              <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "rgba(22, 163, 74, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={28} color="#16A34A" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 500, color: "#1A1A1A" }}>{file.name}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#16A34A" }}>PDF ready — click to change</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ width: 48, height: 48, backgroundColor: "#EFF6FF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#2563EB", fontSize: 22, lineHeight: "28px" }}>↑</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#1A1A1A", fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 500, lineHeight: "18px" }}>Drop a PDF here, or click to browse</span>
                <span style={{ color: "#9CA3AF", fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: "16px" }}>Up to 50 MB</span>
              </div>
            </>
          )}

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ backgroundColor: "#E5E7EB", flex: 1, height: 1 }} />
            <span style={{ color: "#9CA3AF", fontFamily: "'Inter', sans-serif", fontSize: 12, lineHeight: "16px" }}>or</span>
            <div style={{ backgroundColor: "#E5E7EB", flex: 1, height: 1 }} />
          </div>

          {/* URL input + Generate */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", flex: 1, backgroundColor: "#FAFAF8", border: "1px solid #E5E7EB", borderRadius: 8, height: 44, paddingInline: 14 }}>
              <input
                type="text"
                placeholder="https://arxiv.org/abs/..."
                value={url}
                onChange={handleUrlChange}
                style={{ width: "100%", border: "none", outline: "none", backgroundColor: "transparent", fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#1A1A1A", lineHeight: "18px" }}
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: canGenerate ? "#2563EB" : "#93C5FD", borderRadius: 8, border: "none", height: 44, paddingInline: 20, cursor: canGenerate ? "pointer" : "not-allowed", gap: 8 }}
            >
              {isUploading ? (
                <Loader2 size={16} className="animate-spin" color="#FFFFFF" />
              ) : (
                <span style={{ color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, lineHeight: "18px" }}>Generate</span>
              )}
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handleFileSelect} />
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, backgroundColor: "rgba(220, 38, 38, 0.05)", fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#DC2626", width: 640 }}>{error}</div>
        )}
      </div>

      {/* Sample cards */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, paddingBottom: 48, paddingInline: 80, paddingTop: 36 }}>
        <span style={{ color: "#9CA3AF", fontFamily: "'Inter', sans-serif", fontSize: 13, letterSpacing: "0.5px", lineHeight: "16px" }}>or try one of these</span>
        <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
          {examplePapers.map((paper) => (
            <button
              key={paper.id}
              onClick={() => handleExampleClick(paper.id)}
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 12, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "clip", width: 260, cursor: "pointer", padding: 0, textAlign: "left" as const }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#1A1A1A", flexShrink: 0, gap: 8, height: 120, justifyContent: "center", paddingBlock: 20, paddingInline: 20 }}>
                <div style={{ backgroundColor: "#2563EB", borderRadius: 2, height: 3, width: 32 }} />
                <span style={{ color: "#FAFAF8", fontFamily: "'Source Serif 4', serif", fontSize: 16, lineHeight: "20px", textAlign: "center", whiteSpace: "pre-wrap" as const }}>{paper.title.length > 40 ? paper.title.slice(0, 40) : paper.title}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBlock: 14, paddingInline: 16 }}>
                <span style={{ color: "#1A1A1A", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, lineHeight: "16px" }}>{paper.title}</span>
                <span style={{ color: "#9CA3AF", fontFamily: "'Inter', sans-serif", fontSize: 12, lineHeight: "16px" }}>
                  {paper.authors.slice(0, 2).join(", ")}{paper.duration ? ` · ${Math.floor(paper.duration / 60)}:${(paper.duration % 60).toString().padStart(2, "0")}` : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
