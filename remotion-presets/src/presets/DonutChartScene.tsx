import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { z } from "zod";
import rough from "roughjs";
import { loadFont } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: serifFont } = loadFont("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const { fontFamily: sansFont } = loadInter("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

export const DonutChartSchema = z.object({
  title: z.string(),
  labels: z.array(z.string()),
  values: z.array(z.number()),
  centerValue: z.string().optional(),
  centerLabel: z.string().optional(),
});

type DonutChartProps = z.infer<typeof DonutChartSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRIMARY = "#2563EB";
const CARD_W = 1600;
const CARD_H = 900;
const DONUT_COLORS = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DC2626"];

// Donut geometry
const DONUT_CX = 480;
const DONUT_CY = 490;
const DONUT_OUTER_R = 200;
const DONUT_INNER_R = 120; // 60% cutout

// ─────────────────────────────────────────────────────────────────────────────
// Arc path generation (precise, no wobble)
// ─────────────────────────────────────────────────────────────────────────────

function describeArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
  _seed: number,
): string {
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;

  const outerStartX = cx + outerR * Math.cos(startRad);
  const outerStartY = cy + outerR * Math.sin(startRad);
  const outerEndX = cx + outerR * Math.cos(endRad);
  const outerEndY = cy + outerR * Math.sin(endRad);

  const innerStartX = cx + innerR * Math.cos(endRad);
  const innerStartY = cy + innerR * Math.sin(endRad);
  const innerEndX = cx + innerR * Math.cos(startRad);
  const innerEndY = cy + innerR * Math.sin(startRad);

  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${outerStartX} ${outerStartY}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEndX} ${outerEndY}`,
    `L ${innerStartX} ${innerStartY}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEndX} ${innerEndY}`,
    "Z",
  ].join(" ");
}

// Stroke-based arc for the draw-in animation
function describeStrokeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  _seed: number,
): { d: string; length: number } {
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;

  const startX = cx + r * Math.cos(startRad);
  const startY = cy + r * Math.sin(startRad);
  const endX = cx + r * Math.cos(endRad);
  const endY = cy + r * Math.sin(endRad);

  const d = `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;

  // Exact arc length
  const sweepRad = (sweep * Math.PI) / 180;
  const length = r * Math.abs(sweepRad);

  return { d, length };
}

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

// Small rough rectangle for legend swatches
function generateRoughSwatch(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  fillColor: string,
): { paths: string[]; fillPaths: string[] } {
  if (typeof document === "undefined") return { paths: [], fillPaths: [] };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.rectangle(x, y, w, h, {
    roughness: 1.2,
    bowing: 1.5,
    seed,
    stroke: fillColor,
    strokeWidth: 1.5,
    fill: fillColor,
    fillStyle: "solid",
  });
  const paths: string[] = [];
  const fillPaths: string[] = [];
  node.querySelectorAll("path").forEach((p) => {
    const d = p.getAttribute("d");
    if (!d) return;
    const fill = p.getAttribute("fill");
    if (fill && fill !== "none") {
      fillPaths.push(d);
    } else {
      paths.push(d);
    }
  });
  return { paths, fillPaths };
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
        <clipPath id={`donutChart-divider-clip-${seed}`}>
          <rect x={x1} y={y1 - 10} width={clipWidth} height={20} />
        </clipPath>
      </defs>
      <g clipPath={`url(#donutChart-divider-clip-${seed})`}>
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

export const DonutChartScene: React.FC<DonutChartProps> = ({
  title,
  labels,
  values,
  centerValue,
  centerLabel,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const segmentCount = Math.min(labels.length, values.length, 5);
  const total = values.slice(0, segmentCount).reduce((a, b) => a + b, 0);

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

  // === KEN BURNS ===
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

  // === ACCENT LINE (top) ===
  const topLineDelay = Math.round(0.8 * fps);
  const topLineDuration = Math.round(0.8 * fps);
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

  // === TITLE (focus-in blur) ===
  const titleDelay = Math.round(1.2 * fps);
  const titleDuration = Math.round(0.6 * fps);
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

  // === DIVIDER under title ===
  const dividerDelay = Math.round(1.6 * fps);
  const dividerDuration = Math.round(0.8 * fps);
  const dividerProgress = interpolate(
    frame,
    [dividerDelay, dividerDelay + dividerDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // === DONUT SEGMENTS ===
  const donutBaseDelay = Math.round(2.0 * fps);
  const segmentDrawDuration = Math.round(0.5 * fps);
  const segmentStagger = Math.round(0.2 * fps);

  // Compute arc midpoint radius for stroke arcs
  const midR = (DONUT_OUTER_R + DONUT_INNER_R) / 2;
  const strokeW = DONUT_OUTER_R - DONUT_INNER_R;

  // Pre-compute segment angles
  const segments = useMemo(() => {
    let cumulativeAngle = 0;
    return values.slice(0, segmentCount).map((v, i) => {
      const sweep = total > 0 ? (v / total) * 360 : 0;
      const startAngle = cumulativeAngle;
      cumulativeAngle += sweep;
      const endAngle = cumulativeAngle;

      // Generate wobbly fill path
      const fillPath = describeArc(
        DONUT_CX,
        DONUT_CY,
        DONUT_OUTER_R,
        DONUT_INNER_R,
        startAngle,
        endAngle,
        200 + i * 37,
      );

      // Generate stroke arc for draw-in animation
      const strokeArc = describeStrokeArc(
        DONUT_CX,
        DONUT_CY,
        midR,
        startAngle,
        endAngle,
        300 + i * 43,
      );

      return {
        startAngle,
        endAngle,
        sweep,
        fillPath,
        strokeArc,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
      };
    });
  }, [values, segmentCount, total]);

  // Total donut animation end frame
  const lastSegmentEnd =
    donutBaseDelay + (segmentCount - 1) * segmentStagger + segmentDrawDuration;

  // === CENTER VALUE ===
  const centerDelay = lastSegmentEnd + Math.round(0.2 * fps);
  const centerDuration = Math.round(0.5 * fps);
  const centerProgress = interpolate(
    frame,
    [centerDelay, centerDelay + centerDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );
  const centerOpacity = interpolate(centerProgress, [0, 1], [0, 1]);
  const centerScale = interpolate(centerProgress, [0, 1], [0.8, 1]);

  // === LEGEND ===
  const legendBaseDelay = donutBaseDelay + Math.round(0.6 * fps);
  const legendStagger = Math.round(0.15 * fps);

  // Legend swatch rough data
  const swatchData = useMemo(() => {
    return labels.slice(0, segmentCount).map((_, i) => {
      return generateRoughSwatch(
        0,
        0,
        20,
        20,
        500 + i * 11,
        DONUT_COLORS[i % DONUT_COLORS.length],
      );
    });
  }, [labels, segmentCount]);

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
            <filter id="donutChart-paper-grain">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.68"
                numOctaves={4}
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
              filter: "url(#donutChart-paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Rough.js SVG overlay (border + divider) */}
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
              seed={201}
            />
            <RoughDivider
              x1={CARD_W / 2 - 200}
              y1={260}
              x2={CARD_W / 2 + 200}
              y2={260}
              progress={dividerProgress}
              seed={202}
              color="rgba(0, 0, 0, 0.12)"
            />
          </svg>

          {/* Accent line — top */}
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

          {/* Content */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              padding: "60px 80px",
              zIndex: 1,
            }}
          >
            {/* Title */}
            <div
              style={{
                fontFamily: serifFont,
                fontSize: 48,
                fontWeight: 700,
                color: "#1a1a1a",
                letterSpacing: "-0.02em",
                lineHeight: "58px",
                textAlign: "center",
                opacity: titleOpacity,
                transform: `translateY(${titleTranslateY}px)`,
                filter: titleBlur > 0.1 ? `blur(${titleBlur}px)` : undefined,
                marginBottom: 60,
              }}
            >
              {title}
            </div>

            {/* Donut + Legend row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                gap: 80,
              }}
            >
              {/* Donut chart (SVG) */}
              <div style={{ position: "relative", width: DONUT_OUTER_R * 2 + 40, height: DONUT_OUTER_R * 2 + 40 }}>
                <svg
                  width={DONUT_OUTER_R * 2 + 40}
                  height={DONUT_OUTER_R * 2 + 40}
                  viewBox={`${DONUT_CX - DONUT_OUTER_R - 20} ${DONUT_CY - DONUT_OUTER_R - 20} ${DONUT_OUTER_R * 2 + 40} ${DONUT_OUTER_R * 2 + 40}`}
                >
                  {segments.map((seg, i) => {
                    const segDelay = donutBaseDelay + i * segmentStagger;
                    const drawProgress = interpolate(
                      frame,
                      [segDelay, segDelay + segmentDrawDuration],
                      [0, 1],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        easing: Easing.out(Easing.quad),
                      },
                    );

                    if (drawProgress <= 0) return null;

                    // Use strokeDasharray/offset for draw-in effect
                    const dashTotal = seg.strokeArc.length;
                    const dashOffset = dashTotal * (1 - drawProgress);

                    return (
                      <g key={i}>
                        {/* Filled segment that appears once drawn */}
                        <path
                          d={seg.fillPath}
                          fill={seg.color}
                          fillOpacity={drawProgress * 0.85}
                          stroke="none"
                        />
                        {/* Stroke arc for draw-in animation */}
                        <path
                          d={seg.strokeArc.d}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth={strokeW}
                          strokeLinecap="round"
                          strokeDasharray={dashTotal}
                          strokeDashoffset={dashOffset}
                          opacity={0.3 + 0.7 * drawProgress}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Center value overlay */}
                {(centerValue || centerLabel) && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: `translate(-50%, -50%) scale(${centerScale})`,
                      opacity: centerOpacity,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {centerValue && (
                      <div
                        style={{
                          fontFamily: sansFont,
                          fontSize: 42,
                          fontWeight: 700,
                          color: "#1a1a1a",
                          lineHeight: "48px",
                        }}
                      >
                        {centerValue}
                      </div>
                    )}
                    {centerLabel && (
                      <div
                        style={{
                          fontFamily: sansFont,
                          fontSize: 16,
                          fontWeight: 400,
                          color: "#888",
                          marginTop: 4,
                        }}
                      >
                        {centerLabel}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Legend */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {labels.slice(0, segmentCount).map((label, i) => {
                  const legendDelay = legendBaseDelay + i * legendStagger;
                  const legendEntrance = spring({
                    frame,
                    fps,
                    delay: legendDelay,
                    config: { damping: 14, stiffness: 180, mass: 0.6 },
                  });
                  const legendOpacity = interpolate(
                    legendEntrance,
                    [0, 1],
                    [0, 1],
                  );
                  const legendTranslateX = interpolate(
                    legendEntrance,
                    [0, 1],
                    [30, 0],
                  );
                  const swatchScale = interpolate(
                    legendEntrance,
                    [0, 1],
                    [0, 1],
                  );

                  const color = DONUT_COLORS[i % DONUT_COLORS.length];
                  const percentage =
                    total > 0
                      ? ((values[i] / total) * 100).toFixed(1) + "%"
                      : "0%";

                  const swatch = swatchData[i];

                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        opacity: legendOpacity,
                        transform: `translateX(${legendTranslateX}px)`,
                      }}
                    >
                      {/* Rough.js colored swatch */}
                      <svg
                        width={24}
                        height={24}
                        viewBox="-2 -2 24 24"
                        style={{
                          transform: `scale(${swatchScale})`,
                          flexShrink: 0,
                        }}
                      >
                        {swatch.fillPaths.map((d, j) => (
                          <path key={`f-${j}`} d={d} fill={color} stroke="none" />
                        ))}
                        {swatch.paths.map((d, j) => (
                          <path
                            key={`s-${j}`}
                            d={d}
                            fill="none"
                            stroke={color}
                            strokeWidth={1.5}
                          />
                        ))}
                      </svg>

                      {/* Label + value */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: sansFont,
                            fontSize: 18,
                            fontWeight: 600,
                            color: "#333",
                            lineHeight: "24px",
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            fontFamily: sansFont,
                            fontSize: 15,
                            fontWeight: 400,
                            color: "#888",
                            lineHeight: "20px",
                          }}
                        >
                          {values[i].toLocaleString()} ({percentage})
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
