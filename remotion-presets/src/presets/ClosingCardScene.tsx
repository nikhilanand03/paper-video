import { z } from "zod";
import { useMemo } from "react";
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
import { loadFont as loadIBMPlexMono } from "@remotion/google-fonts/IBMPlexMono";

const { fontFamily: serifFont } = loadFont("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const { fontFamily: monoFamily } = loadIBMPlexMono("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

export const ClosingCardSchema = z.object({
  title: z.string(),
  summary: z.string(),
  paperUrl: z.string().optional(),
});

type ClosingCardProps = z.infer<typeof ClosingCardSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRIMARY = "#2563EB";
const CARD_W = 1400;
const CARD_H = 780;

// ─────────────────────────────────────────────────────────────────────────────
// Rough.js helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateRoughRect(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.rectangle(x, y, w, h, {
    roughness: 0.8,
    bowing: 1,
    seed,
    stroke: "rgba(0, 0, 0, 0.08)",
    strokeWidth: 1.5,
    fill: "none",
  });
  const paths: string[] = [];
  node.querySelectorAll("path").forEach((p) => {
    const d = p.getAttribute("d");
    if (d) paths.push(d);
  });
  return paths;
}

function generateRoughLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.line(x1, y1, x2, y2, {
    roughness: 1.0,
    bowing: 1.2,
    seed,
    strokeWidth: 2,
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
  x: number;
  y: number;
  w: number;
  h: number;
  progress: number;
  seed: number;
}> = ({ x, y, w, h, progress, seed }) => {
  const paths = useMemo(
    () => generateRoughRect(x, y, w, h, seed),
    [x, y, w, h, seed],
  );
  if (paths.length === 0 || progress <= 0) return null;
  return (
    <g style={{ opacity: progress }}>
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={1.5}
        />
      ))}
    </g>
  );
};

const RoughDivider: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  progress: number;
  seed: number;
  color: string;
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
        <clipPath id={`closing-divider-clip-${seed}`}>
          <rect x={x1} y={y1 - 10} width={clipWidth} height={20} />
        </clipPath>
      </defs>
      <g clipPath={`url(#closing-divider-clip-${seed})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} />
        ))}
      </g>
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const ClosingCardScene: React.FC<ClosingCardProps> = ({
  title,
  summary,
  paperUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // === ENTRANCE (0–2s): Scale + blur ===
  const entranceSpring = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 80 },
    durationInFrames: 2 * fps,
  });
  const entranceScale = interpolate(entranceSpring, [0, 1], [0.88, 1]);
  const entranceBlur = interpolate(frame, [0, 1.5 * fps], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === BACKGROUND FADE ===
  const bgR = interpolate(frame, [0, 2 * fps], [255, 245], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bgG = interpolate(frame, [0, 2 * fps], [255, 245], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bgB = interpolate(frame, [0, 2 * fps], [255, 240], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === KEN BURNS: Subtle zoom + drift ===
  const kenBurnsScale = interpolate(
    frame,
    [0, durationInFrames],
    [1.0, 1.03],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const driftX = interpolate(frame, [0, durationInFrames], [0, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftY = interpolate(frame, [0, durationInFrames], [0, -3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === AMBIENT LIGHT REFLECTION ===
  const lightX = interpolate(frame, [0, 4 * fps], [30, 70], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lightOpacity = interpolate(
    frame,
    [0, 2 * fps, 4 * fps],
    [0.15, 0.08, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // === PAPER TEXTURE ===
  const grainOpacity = interpolate(frame, [0, 0.8 * fps], [0.14, 0.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const paperTexture = `
    radial-gradient(ellipse at ${lightX}% 30%, rgba(255,255,255,${lightOpacity}) 0%, transparent 60%),
    linear-gradient(160deg, #F5F0E8, #EDE8DC, #E8E2D4)
  `;
  const coffeeStains = `
    radial-gradient(circle at 18% 75%, rgba(139,105,60,0.10) 0%, rgba(139,105,60,0.06) 6%, transparent 13%),
    radial-gradient(circle at 82% 22%, rgba(139,105,60,0.08) 0%, rgba(139,105,60,0.04) 7%, transparent 12%)
  `;
  const edgeVignette = `radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(80,65,40,0.18) 100%)`;
  const sideYellowing = `
    linear-gradient(to right, rgba(180,150,90,0.06) 0%, transparent 8%, transparent 92%, rgba(180,150,90,0.06) 100%)
  `;

  // === SHADOW ===
  const shadowBlur = interpolate(entranceSpring, [0, 1], [30, 20]);
  const shadowY = interpolate(entranceSpring, [0, 1], [15, 8]);
  const shadowOpacity = interpolate(entranceSpring, [0, 1], [0.15, 0.1]);

  // === ROUGH.JS BORDER ===
  const borderProgress = interpolate(frame, [1 * fps, 3 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === ACCENT LINES (inside card) ===
  const topLineDelay = Math.round(0.5 * fps);
  const topLineDuration = Math.round(0.5 * fps);
  const topLineProgress = interpolate(
    frame,
    [topLineDelay, topLineDelay + topLineDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  const bottomLineDelay = Math.round(1.0 * fps);
  const bottomLineDuration = Math.round(0.5 * fps);
  const bottomLineProgress = interpolate(
    frame,
    [bottomLineDelay, bottomLineDelay + bottomLineDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  // === DIVIDER LINE under icon ===
  const dividerDelay = Math.round(1.1 * fps);
  const dividerDuration = Math.round(0.5 * fps);
  const dividerProgress = interpolate(
    frame,
    [dividerDelay, dividerDelay + dividerDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // === ICON ===
  const iconDelay = Math.round(0.7 * fps);
  const iconEntrance = spring({
    frame,
    fps,
    delay: iconDelay,
    config: { damping: 200 },
  });
  const iconScale = interpolate(iconEntrance, [0, 1], [0.92, 1]);
  const iconOpacity = interpolate(iconEntrance, [0, 1], [0, 1]);
  const iconBlur = interpolate(
    frame,
    [iconDelay, iconDelay + Math.round(0.4 * fps)],
    [4, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Subtle breathing
  const breathCycle = Math.round(2.5 * fps);
  const breathFrame = Math.max(0, frame - iconDelay - Math.round(0.5 * fps));
  const breathPhase = (breathFrame % breathCycle) / breathCycle;
  const breathScale = 1 + 0.015 * Math.sin(breathPhase * Math.PI * 2);
  const breathActive = iconEntrance > 0.95 ? 1 : 0;
  const finalIconScale = iconScale * (1 + breathActive * (breathScale - 1));

  // === TITLE ===
  const titleDelay = Math.round(1.1 * fps);
  const titleDuration = Math.round(0.45 * fps);
  const titleProgress = interpolate(
    frame,
    [titleDelay, titleDelay + titleDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleTranslateY = interpolate(titleProgress, [0, 1], [10, 0]);
  const titleBlur = interpolate(titleProgress, [0, 1], [6, 0]);

  // === SUMMARY ===
  const summaryDelay = Math.round(1.3 * fps);
  const summaryDuration = Math.round(0.5 * fps);
  const summaryProgress = interpolate(
    frame,
    [summaryDelay, summaryDelay + summaryDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );
  const summaryOpacity = interpolate(summaryProgress, [0, 0.2, 1], [0, 0.2, 1]);
  const summaryTranslateY = interpolate(summaryProgress, [0, 1], [10, 0]);

  // === LINK PILL ===
  const linkDelay = Math.round(1.7 * fps);
  const linkDuration = Math.round(0.4 * fps);
  const linkOpacity = interpolate(
    frame,
    [linkDelay, linkDelay + linkDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  // Light sweep on link pill
  const sweepDelay = Math.round(2.1 * fps);
  const sweepDuration = Math.round(0.6 * fps);
  const sweepProgress = interpolate(
    frame,
    [sweepDelay, sweepDelay + sweepDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    },
  );
  const sweepX = interpolate(sweepProgress, [0, 1], [-100, 200]);

  const displayUrl = paperUrl
    ? paperUrl.length > 55
      ? paperUrl.slice(0, 52) + "..."
      : paperUrl
    : "";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgb(${bgR}, ${bgG}, ${bgB})`,
      }}
    >
      {/* Ken Burns container */}
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${kenBurnsScale}) translate(${driftX}px, ${driftY}px)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Paper card */}
        <div
          style={{
            width: CARD_W,
            height: CARD_H,
            transform: `scale(${entranceScale})`,
            filter: entranceBlur > 0.1 ? `blur(${entranceBlur}px)` : undefined,
            position: "relative",
            borderRadius: 2,
            boxShadow: `0 ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity})`,
          }}
        >
          {/* Paper background layers */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `${coffeeStains}, ${edgeVignette}, ${sideYellowing}, ${paperTexture}`,
              borderRadius: 2,
            }}
          />

          {/* SVG grain noise overlay */}
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <filter id="closing-paper-grain">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.68"
                numOctaves="4"
                stitchTiles="stitch"
                result="noise"
              />
              <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
            </filter>
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 2,
              filter: "url(#closing-paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Rough.js SVG overlay */}
          <svg
            width={CARD_W}
            height={CARD_H}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
            }}
          >
            <RoughBorder
              x={16}
              y={16}
              w={CARD_W - 32}
              h={CARD_H - 32}
              progress={borderProgress}
              seed={13}
            />
            <RoughDivider
              x1={CARD_W / 2 - 120}
              y1={320}
              x2={CARD_W / 2 + 120}
              y2={320}
              progress={dividerProgress}
              seed={42}
              color="rgba(0, 0, 0, 0.12)"
            />
          </svg>

          {/* Accent lines — thin gradient strips inside the card */}
          <div
            style={{
              position: "absolute",
              top: 24,
              left: 80,
              right: 80,
              height: 2,
              background: `linear-gradient(90deg, ${PRIMARY}, #7C3AED)`,
              transformOrigin: "left center",
              transform: `scaleX(${topLineProgress})`,
              opacity: topLineProgress,
              borderRadius: 1,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 80,
              right: 80,
              height: 2,
              background: `linear-gradient(90deg, #7C3AED, ${PRIMARY})`,
              transformOrigin: "right center",
              transform: `scaleX(${bottomLineProgress})`,
              opacity: bottomLineProgress,
              borderRadius: 1,
            }}
          />

          {/* Content — centered */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 100px",
              zIndex: 1,
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 18,
                backgroundColor: "rgba(245, 240, 232, 0.8)",
                border: "1px solid rgba(0, 0, 0, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: iconOpacity,
                transform: `scale(${finalIconScale})`,
                filter: iconBlur > 0.1 ? `blur(${iconBlur}px)` : undefined,
                boxShadow:
                  "0 2px 12px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0,0,0,0.02)",
                marginBottom: 36,
              }}
            >
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#5A4F3A"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>

            {/* Title */}
            <div
              style={{
                fontFamily: serifFont,
                fontSize: 52,
                fontWeight: 700,
                color: "#1a1a1a",
                letterSpacing: "-0.02em",
                lineHeight: "62px",
                textAlign: "center",
                opacity: titleOpacity,
                transform: `translateY(${titleTranslateY}px)`,
                filter: titleBlur > 0.1 ? `blur(${titleBlur}px)` : undefined,
                marginBottom: 16,
              }}
            >
              {title}
            </div>

            {/* Summary */}
            <div
              style={{
                fontFamily: serifFont,
                fontSize: 24,
                fontWeight: 500,
                color: "#666",
                lineHeight: "38px",
                textAlign: "center",
                maxWidth: 900,
                opacity: summaryOpacity,
                transform: `translateY(${summaryTranslateY}px)`,
                fontStyle: "italic",
                marginBottom: 32,
              }}
            >
              {summary}
            </div>

            {/* Link pill */}
            {paperUrl && (
              <div
                style={{
                  opacity: linkOpacity,
                  position: "relative",
                  overflow: "hidden",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 28px",
                  borderRadius: 999,
                  backgroundColor: "rgba(90, 79, 58, 0.06)",
                  border: "1px solid rgba(90, 79, 58, 0.12)",
                }}
              >
                {/* Light sweep */}
                {sweepProgress > 0 && sweepProgress < 1 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: `${sweepX}%`,
                      width: "30%",
                      height: "100%",
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                      pointerEvents: "none",
                    }}
                  />
                )}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5A4F3A"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span
                  style={{
                    fontFamily: monoFamily,
                    fontSize: 15,
                    color: "#5A4F3A",
                    position: "relative",
                  }}
                >
                  {displayUrl}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
