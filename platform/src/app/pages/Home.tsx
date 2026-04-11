import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Loader2, CheckCircle2 } from "lucide-react";
import { examplePapers, getOrCreateVideoId, seedSampleItems } from "../lib/data";
import { uploadPdf } from "../lib/api";
import { useAuth } from "../lib/useAuth";
import { useJobs } from "../lib/JobContext";
import UserMenu from "../components/UserMenu";

export default function Home() {
  const navigate = useNavigate();
  const { user, signInWithGoogle, signOut } = useAuth();
  const { addJob } = useJobs();
  seedSampleItems();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"brief" | "detailed">("brief");
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
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
      setError(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleGenerate = async () => {
    setError(null);

    if (file) {
      setIsUploading(true);
      try {
        const jobId = await uploadPdf(file, mode);
        addJob(jobId, file.name.replace(/\.pdf$/i, ""));
        navigate(`/video/${jobId}?source=upload&name=${encodeURIComponent(file.name)}`);
      } catch (err: any) {
        if (err.message?.includes("capacity") || err.message?.includes("503")) {
          setError("capacity");
        } else {
          console.warn("Backend not available, using demo mode:", err.message);
          const jobId = getOrCreateVideoId("upload_" + Date.now());
          navigate(
            `/video/${jobId}?source=upload&name=${encodeURIComponent(file.name)}&demo=1`
          );
        }
      } finally {
        setIsUploading(false);
      }
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

  const canGenerate = !!file && !isUploading;

  // Full-screen capacity overlay
  if (error === "capacity") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FAFAF8",
        fontFamily: "'Inter', sans-serif",
        padding: 40,
      }}>
        {/* Hourglass SVG */}
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ marginBottom: 32 }}>
          <circle cx="40" cy="40" r="38" stroke="#E5E7EB" strokeWidth="2" fill="#FAFAF8" />
          <path d="M28 20h24v8c0 6-5 10-12 14c7 4 12 8 12 14v8H28v-8c0-6 5-10 12-14c-7-4-12-8-12-14v-8z" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1.5" />
          <path d="M32 24h16v4c0 4-3.5 7-8 10c-4.5-3-8-6-8-10v-4z" fill="#2563EB" opacity="0.15" />
          <path d="M32 60h16v-4c0-4-3.5-7-8-10c-4.5 3-8 6-8 10v4z" fill="#2563EB" opacity="0.3" />
          <circle cx="40" cy="46" r="2" fill="#2563EB" opacity="0.5" />
        </svg>

        <h1 style={{
          fontFamily: "'Source Serif 4', serif",
          fontSize: 32,
          color: "#1A1A1A",
          fontWeight: 600,
          marginBottom: 12,
          textAlign: "center",
        }}>
          We're at capacity
        </h1>

        <p style={{
          fontSize: 16,
          color: "#6B7280",
          textAlign: "center",
          maxWidth: 420,
          lineHeight: 1.6,
          marginBottom: 8,
        }}>
          Please try again in a few minutes.
        </p>

        <p style={{
          fontSize: 14,
          color: "#9CA3AF",
          textAlign: "center",
          maxWidth: 420,
          lineHeight: 1.5,
          marginBottom: 32,
        }}>
          Our team is working to support more users. Thank you for your patience.
        </p>

        <button
          onClick={() => setError(null)}
          style={{
            padding: "10px 28px",
            backgroundColor: "#2563EB",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Try again
        </button>
      </div>
    );
  }

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
            <UserMenu user={user} signOut={signOut} />
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
        <span style={{ color: "#6B7280", fontFamily: "'Inter', sans-serif", fontSize: 18, lineHeight: 1.6, maxWidth: 520, textAlign: "center" }}>Upload a PDF and get a narrated, animated video in minutes — no editing required.</span>
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

          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handleFileSelect} />
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 16, backgroundColor: "#F4F4F5", borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => setMode("brief")}
            style={{
              padding: "8px 18px", borderRadius: 6, border: "none", cursor: "pointer",
              backgroundColor: mode === "brief" ? "#FFFFFF" : "transparent",
              boxShadow: mode === "brief" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              color: mode === "brief" ? "#1A1A1A" : "#71717A",
              fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500,
            }}
          >
            Brief
          </button>
          <button
            onClick={() => setMode("detailed")}
            style={{
              padding: "8px 18px", borderRadius: 6, border: "none", cursor: "pointer",
              backgroundColor: mode === "detailed" ? "#FFFFFF" : "transparent",
              boxShadow: mode === "detailed" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              color: mode === "detailed" ? "#1A1A1A" : "#71717A",
              fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500,
            }}
          >
            Detailed
          </button>
        </div>
        <span style={{ color: "#9CA3AF", fontFamily: "'Inter', sans-serif", fontSize: 12, marginTop: 4 }}>
          {mode === "brief" ? "Quick summary — 1-2 minutes" : "Comprehensive walkthrough — 5-10 minutes"}
        </span>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: canGenerate ? "#2563EB" : "#93C5FD", borderRadius: 8, border: "none", height: 44, paddingInline: 24, cursor: canGenerate ? "pointer" : "not-allowed", gap: 8, marginTop: 12 }}
        >
          {isUploading ? (
            <Loader2 size={16} className="animate-spin" color="#FFFFFF" />
          ) : (
            <span style={{ color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, lineHeight: "18px" }}>Generate</span>
          )}
        </button>

        {error && error !== "capacity" && (
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
              className="group"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 12, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "clip", width: 260, cursor: "pointer", padding: 0, textAlign: "left" as const, transition: "border-color 0.15s, box-shadow 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, gap: 8, height: 140, paddingBlock: 20, paddingInline: 24, position: "relative", overflow: "hidden",
                background: (() => {
                  const gradients = [
                    "linear-gradient(135deg, #4338ca 0%, #5b21b6 100%)",
                    "linear-gradient(135deg, #be185d 0%, #9f1239 100%)",
                    "linear-gradient(135deg, #1d4ed8 0%, #0e7490 100%)",
                  ];
                  const idx = (paper.title?.length || 0) % gradients.length;
                  return gradients[idx];
                })(),
              }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.2) 0%, transparent 50%)", pointerEvents: "none" }} />
                <div style={{ backgroundColor: "rgba(255,255,255,0.6)", borderRadius: 2, height: 3, width: 32, position: "relative", zIndex: 1 }} />
                <span style={{ color: "#FFFFFF", fontFamily: "'Source Serif 4', serif", fontSize: 16, lineHeight: "20px", textAlign: "center", position: "relative", zIndex: 1, textShadow: "0 1px 3px rgba(0,0,0,0.15)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{paper.title}</span>
                <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Inter', sans-serif", fontSize: 11, position: "relative", zIndex: 1 }}>
                  {paper.authors[0]?.split(" ").pop()} et al.
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBlock: 14, paddingInline: 16 }}>
                <span style={{ color: "#1A1A1A", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, lineHeight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{paper.title}</span>
                <span style={{ color: "#9CA3AF", fontFamily: "'Inter', sans-serif", fontSize: 12, lineHeight: "16px" }}>
                  {paper.duration ? `${Math.floor(paper.duration / 60)}:${(paper.duration % 60).toString().padStart(2, "0")}` : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
