import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Upload, Link as LinkIcon, Loader2, CheckCircle2, Play, Clock } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { examplePapers, getOrCreateVideoId, seedSampleItems } from "../lib/data";
import { uploadPdf, getStreamUrl } from "../lib/api";

export default function Home() {
  const navigate = useNavigate();
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
      // Real upload to FastAPI backend
      setIsUploading(true);
      try {
        const jobId = await uploadPdf(file);
        navigate(`/video/${jobId}?source=upload&name=${encodeURIComponent(file.name)}`);
      } catch (err: any) {
        // Backend not available — fall back to demo mode
        console.warn("Backend not available, using demo mode:", err.message);
        const jobId = getOrCreateVideoId("upload_" + Date.now());
        navigate(
          `/video/${jobId}?source=upload&name=${encodeURIComponent(file.name)}&demo=1`
        );
      } finally {
        setIsUploading(false);
      }
    } else if (url) {
      // URL-based — demo mode for now (backend doesn't support URL input yet)
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

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const canGenerate = (file || url.length > 0) && !isUploading;

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
          <button className="text-[#6B7280] hover:text-[#1A1A1A] transition-colors">
            Sign In
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-8 pt-32 pb-16">
        {/* Headline */}
        <h1
          className="text-center mb-16"
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: "60px",
            letterSpacing: "-1px",
            color: "#1A1A1A",
            fontWeight: 400,
          }}
        >
          Drop a paper. Get a video.
        </h1>

        {/* Drop zone */}
        <div
          className="relative mb-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer"
          style={{
            borderColor: isDragging ? "#2563EB" : file ? "#16A34A" : "#E5E7EB",
            backgroundColor: isDragging
              ? "rgba(37, 99, 235, 0.05)"
              : file
              ? "rgba(22, 163, 74, 0.03)"
              : "#FFFFFF",
            minHeight: "200px",
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center py-12 px-8">
            {file ? (
              <>
                <div
                  className="mb-3 w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(22, 163, 74, 0.1)" }}
                >
                  <CheckCircle2 size={28} style={{ color: "#16A34A" }} />
                </div>
                <p style={{ color: "#1A1A1A", fontWeight: 500 }} className="mb-1">
                  {file.name}
                </p>
                <p style={{ color: "#16A34A" }} className="text-sm mb-1">
                  PDF uploaded successfully
                </p>
                <p style={{ color: "#9CA3AF" }} className="text-xs">
                  Click to change file
                </p>
              </>
            ) : (
              <>
                <Upload
                  className="mb-4"
                  size={48}
                  style={{ color: "#9CA3AF" }}
                />
                <p style={{ color: "#1A1A1A" }} className="mb-2">
                  Drop a PDF here or click to browse
                </p>
                <p style={{ color: "#6B7280" }} className="text-sm">
                  PDF files up to 50 pages
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* URL input */}
        <div className="mb-8">
          <div className="relative">
            <LinkIcon
              className="absolute left-4 top-1/2 -translate-y-1/2"
              size={20}
              style={{ color: "#9CA3AF" }}
            />
            <Input
              type="text"
              placeholder="Or paste arXiv URL or DOI"
              value={url}
              onChange={handleUrlChange}
              className="pl-12 h-14 rounded-xl border-[#E5E7EB] bg-white"
              style={{ fontSize: "16px" }}
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="mb-4 p-4 rounded-xl text-sm"
            style={{ backgroundColor: "rgba(220, 38, 38, 0.05)", color: "#DC2626" }}
          >
            {error}
          </div>
        )}

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full h-14 rounded-xl text-base transition-all hover:brightness-110 hover:shadow-lg"
          style={{
            backgroundColor: canGenerate ? "#2563EB" : "#E5E7EB",
            color: canGenerate ? "#FFFFFF" : "#9CA3AF",
            fontWeight: 500,
            cursor: canGenerate ? "pointer" : "not-allowed",
          }}
        >
          {isUploading ? (
            <span className="flex items-center gap-2">
              <Loader2 size={20} className="animate-spin" />
              Uploading...
            </span>
          ) : (
            "Generate Video"
          )}
        </Button>

        {/* Info text */}
        <p
          className="mt-8 text-center text-sm"
          style={{ color: "#9CA3AF" }}
        >
          PDF, arXiv URL, or DOI. Up to 50 pages. Takes about 2-3 minutes.
        </p>
      </div>

      {/* Showcase — sample videos */}
      <div className="max-w-5xl mx-auto px-8 pt-16 pb-8">
        <h2
          className="text-center mb-10"
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: "36px",
            letterSpacing: "-0.5px",
            color: "#1A1A1A",
            fontWeight: 400,
          }}
        >
          See it in action
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {examplePapers.map((paper) => (
            <button
              key={paper.id}
              onClick={() => handleExampleClick(paper.id)}
              className="group text-left bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden transition-all hover:shadow-lg hover:border-[#2563EB]/30 cursor-pointer"
            >
              {/* Video thumbnail */}
              <div className="relative aspect-video bg-[#0F172A] flex items-center justify-center overflow-hidden">
                {(paper.blobUrl || paper.realJobId) ? (
                  <video
                    src={paper.blobUrl || getStreamUrl(paper.realJobId)}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    muted
                    preload="metadata"
                    onLoadedMetadata={(e) => {
                      (e.target as HTMLVideoElement).currentTime = 5;
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1E293B] to-[#0F172A]" />
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100">
                    <Play size={24} className="text-[#1A1A1A] ml-1" fill="#1A1A1A" />
                  </div>
                </div>
                {/* Duration badge */}
                {paper.duration && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded bg-black/60 text-white text-xs">
                    <Clock size={10} />
                    {formatDuration(paper.duration)}
                  </div>
                )}
              </div>
              {/* Card body */}
              <div className="p-4">
                <p
                  className="font-medium text-sm leading-snug mb-1 line-clamp-2"
                  style={{ color: "#1A1A1A" }}
                >
                  {paper.title}
                </p>
                <p className="text-xs" style={{ color: "#6B7280" }}>
                  {paper.authors.join(", ")}
                  {paper.venue && ` · ${paper.venue}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-8 py-16">
        <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB]">
          <h2
            className="text-center mb-8"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "38px",
              letterSpacing: "-0.5px",
              color: "#1A1A1A",
              fontWeight: 600,
            }}
          >
            How it works
          </h2>

          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex gap-4 items-start">
              <div
                className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: "#2563EB", fontWeight: 500 }}
              >
                1
              </div>
              <div className="pt-2">
                <p style={{ color: "#1A1A1A" }}>
                  <strong>We read the paper</strong> — Extracting text,
                  figures, tables, and equations
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div
                className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: "#2563EB", fontWeight: 500 }}
              >
                2
              </div>
              <div className="pt-2">
                <p style={{ color: "#1A1A1A" }}>
                  <strong>AI extracts key findings</strong> — Identifying
                  main contributions, results, and insights
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div
                className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: "#2563EB", fontWeight: 500 }}
              >
                3
              </div>
              <div className="pt-2">
                <p style={{ color: "#1A1A1A" }}>
                  <strong>You get a narrated walkthrough</strong> — A clean
                  video explaining the paper in minutes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
