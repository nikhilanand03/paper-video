import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  AbsoluteFill,
} from "remotion";
import { z } from "zod";
import rough from "roughjs";
import { loadFont } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

const { fontFamily: serifFont } = loadFont("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const { fontFamily: monoFont } = loadMono("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

// ── Schema ───────────────────────────────────────────────────────────────────

export const HeatmapSchema = z.object({
  title: z.string(),
  rowLabels: z.array(z.string()),
  colLabels: z.array(z.string()),
  matrix: z.array(z.array(z.number())),
  colorScale: z.enum(["blue", "green", "red", "purple"]).optional(),
});

type Props = z.infer<typeof HeatmapSchema>;

// ── Seeded noise helpers ─────────────────────────────────────────────────────

function seededNoise(seed: number): number {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

function wobble(seed: number, amplitude = 2): number {
  return (seededNoise(seed) - 0.5) * 2 * amplitude;
}

// ── Color scale helpers ──────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue: "37, 99, 235",
  green: "5, 150, 105",
  red: "220, 38, 38",
  purple: "124, 58, 237",
};

// ── Rough.js helpers ─────────────────────────────────────────────────────────

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

// ── Rough cell border ────────────────────────────────────────────────────────

function generateRoughCellRect(
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
    roughness: 0.6,
    bowing: 0.8,
    seed,
    stroke: "rgba(0, 0, 0, 0.12)",
    strokeWidth: 1,
    fill: "none",
  });
  const paths: string[] = [];
  node.querySelectorAll("path").forEach((p) => {
    const d = p.getAttribute("d");
    if (d) paths.push(d);
  });
  return paths;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CARD_W = 1600;
const CARD_H = 900;

// ── Main Scene ───────────────────────────────────────────────────────────────

export const HeatmapScene: React.FC<Props> = ({
  title,
  rowLabels,
  colLabels,
  matrix,
  colorScale = "blue",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const baseColor = COLOR_MAP[colorScale] || COLOR_MAP.blue;

  // Normalize matrix values
  const allValues = matrix.flat();
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  const numRows = rowLabels.length;
  const numCols = colLabels.length;

  // === CARD ENTRANCE (0-2s): Scale + blur ===
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
  const driftX = interpolate(frame, [0, durationInFrames], [0, 5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftY = interpolate(frame, [0, durationInFrames], [0, -3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === AMBIENT LIGHT ===
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
    radial-gradient(circle at 12% 82%, rgba(139,105,60,0.10) 0%, rgba(139,105,60,0.06) 6%, transparent 13%),
    radial-gradient(circle at 88% 15%, rgba(139,105,60,0.08) 0%, rgba(139,105,60,0.04) 7%, transparent 12%)
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

  // === Grid layout ===
  const GRID_PAD_LEFT = 140;
  const GRID_PAD_RIGHT = 60;
  const GRID_PAD_TOP = 100;
  const GRID_PAD_BOTTOM = 80;

  const gridW = CARD_W - GRID_PAD_LEFT - GRID_PAD_RIGHT;
  const gridH = CARD_H - GRID_PAD_TOP - GRID_PAD_BOTTOM;
  const cellW = gridW / numCols;
  const cellH = gridH / numRows;

  // === Title animation (focus-in blur) ===
  const titleAlpha = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleBlur = interpolate(frame, [0, 20], [6, 0], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 20], [40, 55], {
    easing: Easing.out(Easing.quad),
    extrapolateRight: "clamp",
  });

  // === Label animation ===
  const labelAlpha = interpolate(frame, [0.5 * fps, 1.2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === Cell rough borders (memoized) ===
  const cellBorders = useMemo(() => {
    const borders: Record<string, string[]> = {};
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cx = GRID_PAD_LEFT + c * cellW;
        const cy = GRID_PAD_TOP + r * cellH;
        borders[`${r}-${c}`] = generateRoughCellRect(
          cx,
          cy,
          cellW,
          cellH,
          r * 100 + c * 10 + 42,
        );
      }
    }
    return borders;
  }, [numRows, numCols, cellW, cellH]);

  // === Legend ===
  const legendY = CARD_H - 40;
  const legendW = 200;
  const legendX = CARD_W / 2 - legendW / 2;
  const legendAlpha = interpolate(frame, [3 * fps, 3.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
            <filter id="heatmap-paper-grain">
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
              filter: "url(#heatmap-paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Chart SVG */}
          <svg
            width={CARD_W}
            height={CARD_H}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              zIndex: 1,
            }}
          >
            {/* Rough.js border */}
            <RoughBorder
              x={16}
              y={16}
              w={CARD_W - 32}
              h={CARD_H - 32}
              progress={borderProgress}
              seed={31}
            />

            {/* Title (focus-in blur) */}
            <text
              x={CARD_W / 2 + wobble(999)}
              y={titleY}
              textAnchor="middle"
              fontFamily={serifFont}
              fontSize="34"
              fontWeight="700"
              fill="#333"
              opacity={titleAlpha}
              style={{
                filter:
                  titleBlur > 0.1 ? `blur(${titleBlur}px)` : undefined,
              }}
            >
              {title}
            </text>

            {/* Column labels */}
            <g opacity={labelAlpha}>
              {colLabels.map((label, c) => {
                const cx = GRID_PAD_LEFT + c * cellW + cellW / 2;
                return (
                  <text
                    key={`col-${c}`}
                    x={cx + wobble(c * 7 + 200, 1)}
                    y={GRID_PAD_TOP - 12 + wobble(c * 7 + 201, 1)}
                    textAnchor="middle"
                    fontFamily={monoFont}
                    fontSize="14"
                    fill="#555"
                  >
                    {label}
                  </text>
                );
              })}
            </g>

            {/* Row labels */}
            <g opacity={labelAlpha}>
              {rowLabels.map((label, r) => {
                const cy = GRID_PAD_TOP + r * cellH + cellH / 2;
                return (
                  <text
                    key={`row-${r}`}
                    x={GRID_PAD_LEFT - 14 + wobble(r * 7 + 300, 1)}
                    y={cy + 5 + wobble(r * 7 + 301, 1)}
                    textAnchor="end"
                    fontFamily={monoFont}
                    fontSize="14"
                    fill="#555"
                  >
                    {label}
                  </text>
                );
              })}
            </g>

            {/* Heatmap cells */}
            {matrix.map((row, r) =>
              row.map((value, c) => {
                const cx = GRID_PAD_LEFT + c * cellW;
                const cy = GRID_PAD_TOP + r * cellH;
                const normalizedVal =
                  (value - minVal) / range;
                const opacity = 0.08 + normalizedVal * 0.84; // 0.08 -> 0.92

                // Diagonal sweep stagger
                const diagIndex = r + c;
                const cellDelay = 1.2 * fps + diagIndex * 3;

                const cellAlpha = interpolate(
                  frame,
                  [cellDelay, cellDelay + 12],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );

                const valueDelay = cellDelay + 10;
                const valueAlpha = interpolate(
                  frame,
                  [valueDelay, valueDelay + 8],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );

                const borderPaths = cellBorders[`${r}-${c}`] || [];

                return (
                  <g key={`cell-${r}-${c}`}>
                    {/* Cell fill */}
                    <rect
                      x={cx + 1}
                      y={cy + 1}
                      width={cellW - 2}
                      height={cellH - 2}
                      fill={`rgba(${baseColor}, ${opacity})`}
                      opacity={cellAlpha}
                      rx={1}
                    />

                    {/* Rough cell border */}
                    {cellAlpha > 0.5 &&
                      borderPaths.map((d, i) => (
                        <path
                          key={i}
                          d={d}
                          fill="none"
                          stroke="rgba(0,0,0,0.12)"
                          strokeWidth={1}
                          opacity={cellAlpha}
                        />
                      ))}

                    {/* Value text */}
                    <text
                      x={cx + cellW / 2 + wobble(r * 50 + c * 7 + 400, 1)}
                      y={
                        cy +
                        cellH / 2 +
                        5 +
                        wobble(r * 50 + c * 7 + 401, 1)
                      }
                      textAnchor="middle"
                      fontFamily={monoFont}
                      fontSize={cellW > 60 ? "13" : "11"}
                      fill={normalizedVal > 0.55 ? "#fff" : "#333"}
                      opacity={valueAlpha}
                    >
                      {value}
                    </text>
                  </g>
                );
              }),
            )}

            {/* Color legend bar */}
            <g opacity={legendAlpha}>
              <defs>
                <linearGradient
                  id="heatmap-legend-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop
                    offset="0%"
                    stopColor={`rgba(${baseColor}, 0.08)`}
                  />
                  <stop
                    offset="100%"
                    stopColor={`rgba(${baseColor}, 0.92)`}
                  />
                </linearGradient>
              </defs>
              <rect
                x={legendX}
                y={legendY - 10}
                width={legendW}
                height={14}
                fill="url(#heatmap-legend-grad)"
                rx={2}
              />
              <text
                x={legendX - 8}
                y={legendY + 2}
                textAnchor="end"
                fontFamily={monoFont}
                fontSize="12"
                fill="#777"
              >
                {minVal}
              </text>
              <text
                x={legendX + legendW + 8}
                y={legendY + 2}
                textAnchor="start"
                fontFamily={monoFont}
                fontSize="12"
                fill="#777"
              >
                {maxVal}
              </text>
            </g>
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};
