import React, { useMemo } from "react";
import { z } from "zod";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import rough from "roughjs";
import { loadFont } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: serifFont } = loadFont("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const { fontFamily: sansFont } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const PanelSchema = z.object({
  label: z.string(),
  tone: z.enum(["positive", "negative", "neutral"]).default("neutral"),
  points: z.array(z.string()),
});

export const ComparisonSplitSchema = z.object({
  heading: z.string(),
  left: PanelSchema,
  right: PanelSchema,
});

type ComparisonSplitProps = z.infer<typeof ComparisonSplitSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CARD_W = 1600;
const CARD_H = 900;

const TONE_COLORS = {
  positive: { accent: "#059669", bg: "rgba(5, 150, 105, 0.08)", border: "rgba(5, 150, 105, 0.25)" },
  negative: { accent: "#DC2626", bg: "rgba(220, 38, 38, 0.08)", border: "rgba(220, 38, 38, 0.25)" },
  neutral: { accent: "#6B7280", bg: "#F3F4F6", border: "#D1D5DB" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Rough.js helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateRoughRect(
  x: number, y: number, w: number, h: number, seed: number,
): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.rectangle(x, y, w, h, {
    roughness: 0.8, bowing: 1, seed,
    stroke: "rgba(0, 0, 0, 0.08)", strokeWidth: 1.5, fill: "none",
  });
  const paths: string[] = [];
  node.querySelectorAll("path").forEach((p) => {
    const d = p.getAttribute("d");
    if (d) paths.push(d);
  });
  return paths;
}

function generateRoughCircle(
  cx: number, cy: number, diameter: number, seed: number,
  stroke: string, strokeWidth: number,
): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.circle(cx, cy, diameter, {
    roughness: 1.0, bowing: 1.5, seed, stroke, strokeWidth, fill: "none",
  });
  const paths: string[] = [];
  node.querySelectorAll("path").forEach((p) => {
    const d = p.getAttribute("d");
    if (d) paths.push(d);
  });
  return paths;
}

function generateRoughLine(
  x1: number, y1: number, x2: number, y2: number, seed: number,
): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.line(x1, y1, x2, y2, {
    roughness: 1.0, bowing: 1.2, seed, strokeWidth: 1.5,
  });
  const paths: string[] = [];
  node.querySelectorAll("path").forEach((p) => {
    const d = p.getAttribute("d");
    if (d) paths.push(d);
  });
  return paths;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rough.js sub-components
// ─────────────────────────────────────────────────────────────────────────────

const RoughBorder: React.FC<{
  x: number; y: number; w: number; h: number;
  progress: number; seed: number;
}> = ({ x, y, w, h, progress, seed }) => {
  const paths = useMemo(() => generateRoughRect(x, y, w, h, seed), [x, y, w, h, seed]);
  if (paths.length === 0 || progress <= 0) return null;
  return (
    <g style={{ opacity: progress }}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={1.5} />
      ))}
    </g>
  );
};

const RoughVsBadge: React.FC<{
  cx: number; cy: number; progress: number; seed: number;
}> = ({ cx, cy, progress, seed }) => {
  const paths = useMemo(
    () => generateRoughCircle(cx, cy, 56, seed, "#2563EB", 2),
    [cx, cy, seed],
  );
  if (paths.length === 0 || progress <= 0) return null;
  return (
    <g style={{ opacity: progress }}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#2563EB" strokeWidth={2} />
      ))}
    </g>
  );
};

const RoughPanelBorder: React.FC<{
  x: number; y: number; w: number; h: number;
  progress: number; seed: number; stroke: string;
}> = ({ x, y, w, h, progress, seed, stroke }) => {
  const paths = useMemo(() => {
    if (typeof document === "undefined") return [];
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const rc = rough.svg(svg);
    const node = rc.rectangle(x, y, w, h, {
      roughness: 0.6, bowing: 0.8, seed, stroke, strokeWidth: 1.5, fill: "none",
    });
    const result: string[] = [];
    node.querySelectorAll("path").forEach((p) => {
      const d = p.getAttribute("d");
      if (d) result.push(d);
    });
    return result;
  }, [x, y, w, h, seed, stroke]);
  if (paths.length === 0 || progress <= 0) return null;
  return (
    <g style={{ opacity: progress }}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={stroke} strokeWidth={1.5} />
      ))}
    </g>
  );
};

const RoughHeaderLine: React.FC<{
  x1: number; y1: number; x2: number; y2: number;
  progress: number; seed: number; color: string;
}> = ({ x1, y1, x2, y2, progress, seed, color }) => {
  const paths = useMemo(
    () => generateRoughLine(x1, y1, x2, y2, seed),
    [x1, y1, x2, y2, seed],
  );
  if (paths.length === 0 || progress <= 0) return null;
  const clipWidth = (x2 - x1) * progress;
  return (
    <g>
      <defs>
        <clipPath id={`comp-line-clip-${seed}`}>
          <rect x={x1} y={y1 - 10} width={clipWidth} height={20} />
        </clipPath>
      </defs>
      <g clipPath={`url(#comp-line-clip-${seed})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={1.5} />
        ))}
      </g>
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tone icon SVGs
// ─────────────────────────────────────────────────────────────────────────────

const ToneIcon: React.FC<{ tone: string; color: string }> = ({ tone, color }) => {
  if (tone === "positive") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2.5 7.5 5.5 10.5 11.5 4.5" />
      </svg>
    );
  }
  if (tone === "negative") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="3" x2="11" y2="11" />
        <line x1="11" y1="3" x2="3" y2="11" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="7" x2="11" y2="7" />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const ComparisonSplitScene: React.FC<ComparisonSplitProps> = ({
  heading,
  left,
  right,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // === CARD ENTRANCE ===
  const entranceSpring = spring({
    frame, fps,
    config: { damping: 200, stiffness: 80 },
    durationInFrames: 2 * fps,
  });
  const entranceScale = interpolate(entranceSpring, [0, 1], [0.88, 1]);
  const entranceBlur = interpolate(frame, [0, 1.5 * fps], [8, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // === BACKGROUND ===
  const bgR = interpolate(frame, [0, 2 * fps], [255, 245], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bgG = interpolate(frame, [0, 2 * fps], [255, 245], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bgB = interpolate(frame, [0, 2 * fps], [255, 240], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // === KEN BURNS ===
  const kenBurnsScale = interpolate(frame, [0, durationInFrames], [1.0, 1.03], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const driftX = interpolate(frame, [0, durationInFrames], [0, 5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const driftY = interpolate(frame, [0, durationInFrames], [0, -3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // === AMBIENT LIGHT ===
  const lightX = interpolate(frame, [0, 4 * fps], [30, 70], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lightOpacity = interpolate(frame, [0, 2 * fps, 4 * fps], [0.15, 0.08, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // === PAPER TEXTURE ===
  const grainOpacity = interpolate(frame, [0, 0.8 * fps], [0.14, 0.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const paperTexture = `
    radial-gradient(ellipse at ${lightX}% 30%, rgba(255,255,255,${lightOpacity}) 0%, transparent 60%),
    linear-gradient(160deg, #F5F0E8, #EDE8DC, #E8E2D4)
  `;
  const coffeeStains = `
    radial-gradient(circle at 10% 85%, rgba(139,105,60,0.10) 0%, rgba(139,105,60,0.06) 6%, transparent 13%),
    radial-gradient(circle at 90% 12%, rgba(139,105,60,0.08) 0%, rgba(139,105,60,0.04) 7%, transparent 12%)
  `;
  const edgeVignette = `radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(80,65,40,0.18) 100%)`;
  const sideYellowing = `linear-gradient(to right, rgba(180,150,90,0.06) 0%, transparent 8%, transparent 92%, rgba(180,150,90,0.06) 100%)`;

  // === SHADOW ===
  const shadowBlurVal = interpolate(entranceSpring, [0, 1], [30, 20]);
  const shadowY = interpolate(entranceSpring, [0, 1], [15, 8]);
  const shadowOpacity = interpolate(entranceSpring, [0, 1], [0.15, 0.1]);

  // === ROUGH.JS BORDER ===
  const borderProgress = interpolate(frame, [1 * fps, 3 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // === ACCENT LINE ===
  const accentDelay = Math.round(0.8 * fps);
  const accentProgress = interpolate(frame, [accentDelay, accentDelay + Math.round(0.8 * fps)], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad),
  });

  // === HEADING ===
  const headingDelay = Math.round(1.0 * fps);
  const headingDuration = Math.round(0.6 * fps);
  const headingProgress = interpolate(frame, [headingDelay, headingDelay + headingDuration], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad),
  });
  const headingOpacity = interpolate(headingProgress, [0, 1], [0, 1]);
  const headingTranslateY = interpolate(headingProgress, [0, 1], [10, 0]);
  const headingBlur = interpolate(headingProgress, [0, 1], [6, 0]);

  // === PANELS ===
  const leftPanelDelay = Math.round(1.4 * fps);
  const rightPanelDelay = Math.round(1.4 * fps);
  const leftPanelSpring = spring({
    frame, fps, delay: leftPanelDelay,
    config: { damping: 200 },
  });
  const leftPanelOpacity = interpolate(leftPanelSpring, [0, 1], [0, 1]);
  const leftPanelX = interpolate(leftPanelSpring, [0, 1], [-16, 0]);

  const rightPanelSpring = spring({
    frame, fps, delay: rightPanelDelay,
    config: { damping: 200 },
  });
  const rightPanelOpacity = interpolate(rightPanelSpring, [0, 1], [0, 1]);
  const rightPanelX = interpolate(rightPanelSpring, [0, 1], [16, 0]);

  // Panel header divider lines
  const headerLineDelay = Math.round(2.0 * fps);
  const headerLineProgress = interpolate(frame, [headerLineDelay, headerLineDelay + Math.round(0.6 * fps)], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Panel border (rough.js)
  const panelBorderProgress = interpolate(frame, [1.6 * fps, 3.0 * fps], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // === VS BADGE ===
  const vsDelay = Math.round(2.2 * fps);
  const vsSpring = spring({
    frame, fps, delay: vsDelay,
    config: { damping: 15, stiffness: 180 },
  });
  const vsScale = interpolate(vsSpring, [0, 1], [0.6, 1]);
  const vsOpacity = interpolate(vsSpring, [0, 1], [0, 1]);

  // VS rough circle
  const vsCircleProgress = interpolate(frame, [vsDelay, vsDelay + Math.round(0.6 * fps)], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // === BULLET ITEMS ===
  const bulletBaseDelay = Math.round(2.4 * fps);
  const bulletStagger = Math.round(0.15 * fps);
  const bulletDuration = Math.round(0.4 * fps);

  // Panel layout constants (relative to card)
  const panelPadX = 60;
  const panelGap = 32;
  const panelW = (CARD_W - panelPadX * 2 - panelGap) / 2;
  const panelStartY = 140; // below heading
  const panelH = CARD_H - panelStartY - 50;

  const leftColors = TONE_COLORS[left.tone];
  const rightColors = TONE_COLORS[right.tone];

  return (
    <AbsoluteFill style={{ backgroundColor: `rgb(${bgR}, ${bgG}, ${bgB})` }}>
      <div
        style={{
          width: "100%", height: "100%",
          transform: `scale(${kenBurnsScale}) translate(${driftX}px, ${driftY}px)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {/* Paper card */}
        <div
          style={{
            width: CARD_W, height: CARD_H,
            transform: `scale(${entranceScale})`,
            filter: entranceBlur > 0.1 ? `blur(${entranceBlur}px)` : undefined,
            position: "relative", borderRadius: 2,
            boxShadow: `0 ${shadowY}px ${shadowBlurVal}px rgba(0, 0, 0, ${shadowOpacity})`,
          }}
        >
          {/* Paper background layers */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `${coffeeStains}, ${edgeVignette}, ${sideYellowing}, ${paperTexture}`,
            borderRadius: 2,
          }} />

          {/* SVG grain noise overlay */}
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <filter id="comparison-paper-grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" result="noise" />
              <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
            </filter>
          </svg>
          <div style={{
            position: "absolute", inset: 0, borderRadius: 2,
            filter: "url(#comparison-paper-grain)",
            opacity: grainOpacity, backgroundColor: "rgba(200,190,170,0.3)",
            mixBlendMode: "multiply",
          }} />

          {/* Rough.js SVG overlay */}
          <svg
            width={CARD_W} height={CARD_H}
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 3 }}
          >
            <RoughBorder x={16} y={16} w={CARD_W - 32} h={CARD_H - 32} progress={borderProgress} seed={71} />

            {/* Panel borders */}
            <RoughPanelBorder
              x={panelPadX} y={panelStartY} w={panelW} h={panelH}
              progress={panelBorderProgress} seed={80} stroke={leftColors.border}
            />
            <RoughPanelBorder
              x={panelPadX + panelW + panelGap} y={panelStartY} w={panelW} h={panelH}
              progress={panelBorderProgress} seed={85} stroke={rightColors.border}
            />

            {/* Header divider lines inside panels */}
            <RoughHeaderLine
              x1={panelPadX + 24} y1={panelStartY + 68}
              x2={panelPadX + panelW - 24} y2={panelStartY + 68}
              progress={headerLineProgress} seed={90} color="rgba(0,0,0,0.08)"
            />
            <RoughHeaderLine
              x1={panelPadX + panelW + panelGap + 24} y1={panelStartY + 68}
              x2={panelPadX + panelW + panelGap + panelW - 24} y2={panelStartY + 68}
              progress={headerLineProgress} seed={95} color="rgba(0,0,0,0.08)"
            />

            {/* VS badge circle */}
            <RoughVsBadge
              cx={CARD_W / 2} cy={panelStartY + panelH / 2}
              progress={vsCircleProgress} seed={100}
            />
          </svg>

          {/* Accent line — top */}
          <div style={{
            position: "absolute", top: 24, left: 80, right: 80, height: 2,
            background: "linear-gradient(90deg, #2563EB, #7C3AED)",
            transformOrigin: "left center", transform: `scaleX(${accentProgress})`,
            opacity: accentProgress, borderRadius: 1,
          }} />

          {/* Content */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: `60px ${panelPadX}px 40px`,
            zIndex: 1,
          }}>
            {/* Heading */}
            <div style={{
              fontFamily: serifFont, fontSize: 42, fontWeight: 700,
              color: "#1a1a1a", letterSpacing: "-0.02em",
              textAlign: "center", marginBottom: 36,
              opacity: headingOpacity,
              transform: `translateY(${headingTranslateY}px)`,
              filter: headingBlur > 0.1 ? `blur(${headingBlur}px)` : undefined,
            }}>
              {heading}
            </div>

            {/* Panels container */}
            <div style={{
              display: "flex", gap: panelGap, width: "100%", flex: 1,
              position: "relative",
            }}>
              {/* Left panel */}
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                opacity: leftPanelOpacity,
                transform: `translateX(${leftPanelX}px)`,
              }}>
                {/* Panel header */}
                <div style={{
                  padding: "20px 28px 20px",
                  marginBottom: 24,
                }}>
                  <div style={{
                    fontFamily: sansFont, fontSize: 26, fontWeight: 600,
                    color: leftColors.accent,
                  }}>
                    {left.label}
                  </div>
                </div>

                {/* Points */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "0 28px" }}>
                  {left.points.map((point, idx) => {
                    const itemStart = bulletBaseDelay + idx * bulletStagger;
                    const progress = interpolate(frame, [itemStart, itemStart + bulletDuration], [0, 1], {
                      extrapolateLeft: "clamp", extrapolateRight: "clamp",
                      easing: Easing.out(Easing.quad),
                    });
                    const itemOpacity = interpolate(progress, [0, 1], [0, 1]);
                    const itemY = interpolate(progress, [0, 1], [10, 0]);
                    return (
                      <div key={idx} style={{
                        display: "flex", alignItems: "flex-start", gap: 14,
                        opacity: itemOpacity, transform: `translateY(${itemY}px)`,
                      }}>
                        <div style={{
                          width: 26, height: 26, minWidth: 26, borderRadius: "50%",
                          backgroundColor: leftColors.bg, display: "flex",
                          alignItems: "center", justifyContent: "center", marginTop: 2,
                        }}>
                          <ToneIcon tone={left.tone} color={leftColors.accent} />
                        </div>
                        <span style={{
                          fontFamily: sansFont, fontSize: 21, color: "#3D3428",
                          lineHeight: "32px",
                        }}>
                          {point}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* VS badge */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: `translate(-50%, -50%) scale(${vsScale})`,
                opacity: vsOpacity, zIndex: 10,
                width: 56, height: 56, borderRadius: "50%",
                backgroundColor: "rgba(245, 240, 232, 0.95)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: sansFont, fontSize: 18, fontWeight: 700,
                color: "#2563EB",
              }}>
                VS
              </div>

              {/* Right panel */}
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                opacity: rightPanelOpacity,
                transform: `translateX(${rightPanelX}px)`,
              }}>
                {/* Panel header */}
                <div style={{
                  padding: "20px 28px 20px",
                  marginBottom: 24,
                }}>
                  <div style={{
                    fontFamily: sansFont, fontSize: 26, fontWeight: 600,
                    color: rightColors.accent,
                  }}>
                    {right.label}
                  </div>
                </div>

                {/* Points */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "0 28px" }}>
                  {right.points.map((point, idx) => {
                    // Right-side bullets stagger slightly after left
                    const itemStart = bulletBaseDelay + Math.round(0.3 * fps) + idx * bulletStagger;
                    const progress = interpolate(frame, [itemStart, itemStart + bulletDuration], [0, 1], {
                      extrapolateLeft: "clamp", extrapolateRight: "clamp",
                      easing: Easing.out(Easing.quad),
                    });
                    const itemOpacity = interpolate(progress, [0, 1], [0, 1]);
                    const itemY = interpolate(progress, [0, 1], [10, 0]);
                    return (
                      <div key={idx} style={{
                        display: "flex", alignItems: "flex-start", gap: 14,
                        opacity: itemOpacity, transform: `translateY(${itemY}px)`,
                      }}>
                        <div style={{
                          width: 26, height: 26, minWidth: 26, borderRadius: "50%",
                          backgroundColor: rightColors.bg, display: "flex",
                          alignItems: "center", justifyContent: "center", marginTop: 2,
                        }}>
                          <ToneIcon tone={right.tone} color={rightColors.accent} />
                        </div>
                        <span style={{
                          fontFamily: sansFont, fontSize: 21, color: "#3D3428",
                          lineHeight: "32px",
                        }}>
                          {point}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
