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
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

const { fontFamily: serifFont } = loadFont("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const { fontFamily: sansFont } = loadInter("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

const { fontFamily: monoFont } = loadMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

export const DataTableSchema = z.object({
  title: z.string(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  caption: z.string().optional(),
});

type DataTableProps = z.infer<typeof DataTableSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CARD_W = 1600;
const CARD_H = 900;
const HEADER_COLOR = "#5B4C3A";

// Watercolor wash tints for alternating rows
const ROW_WASHES = [
  "rgba(210, 195, 168, 0.18)",
  "rgba(185, 205, 195, 0.14)",
  "rgba(200, 188, 175, 0.16)",
  "rgba(190, 200, 185, 0.13)",
];

// ─────────────────────────────────────────────────────────────────────────────
// Rough.js helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateRoughRect(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  options?: {
    stroke?: string;
    strokeWidth?: number;
    roughness?: number;
    fill?: string;
    fillStyle?: string;
  },
): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.rectangle(x, y, w, h, {
    roughness: options?.roughness ?? 0.8,
    bowing: 1,
    seed,
    stroke: options?.stroke ?? "rgba(0, 0, 0, 0.08)",
    strokeWidth: options?.strokeWidth ?? 1.5,
    fill: options?.fill ?? "none",
    fillStyle: options?.fillStyle ?? "hachure",
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
  options?: { stroke?: string; strokeWidth?: number; roughness?: number },
): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.line(x1, y1, x2, y2, {
    roughness: options?.roughness ?? 1.0,
    bowing: 1.2,
    seed,
    stroke: options?.stroke ?? "rgba(0,0,0,0.15)",
    strokeWidth: options?.strokeWidth ?? 1.5,
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

/** A rough.js line that appears to be "drawn" via a clip-path reveal */
const RoughDrawnLine: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  progress: number;
  seed: number;
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  clipId: string;
}> = ({ x1, y1, x2, y2, progress, seed, stroke, strokeWidth, roughness, clipId }) => {
  const paths = useMemo(
    () =>
      generateRoughLine(x1, y1, x2, y2, seed, {
        stroke: stroke ?? "rgba(0,0,0,0.12)",
        strokeWidth: strokeWidth ?? 1.2,
        roughness: roughness ?? 0.8,
      }),
    [x1, y1, x2, y2, seed, stroke, strokeWidth, roughness],
  );
  if (paths.length === 0 || progress <= 0) return null;

  const isHorizontal = Math.abs(x2 - x1) > Math.abs(y2 - y1);
  let clipRect: { x: number; y: number; width: number; height: number };
  if (isHorizontal) {
    const clipWidth = (x2 - x1) * progress;
    clipRect = { x: Math.min(x1, x2), y: Math.min(y1, y2) - 10, width: Math.abs(clipWidth), height: Math.abs(y2 - y1) + 20 };
  } else {
    const clipHeight = (y2 - y1) * progress;
    clipRect = { x: Math.min(x1, x2) - 10, y: Math.min(y1, y2), width: Math.abs(x2 - x1) + 20, height: Math.abs(clipHeight) };
  }

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={clipRect.x}
            y={clipRect.y}
            width={clipRect.width}
            height={clipRect.height}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={stroke ?? "rgba(0,0,0,0.12)"}
            strokeWidth={strokeWidth ?? 1.2}
          />
        ))}
      </g>
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: detect if a string looks numeric
// ─────────────────────────────────────────────────────────────────────────────

function looksNumeric(s: string): boolean {
  return /^[\d$\u20AC\u00A3\u00A5%.,+\-/\u00D7xX]+$/.test(s.trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const DataTableScene: React.FC<DataTableProps> = ({
  title,
  columns,
  rows,
  caption,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // === ENTRANCE (0-2s): Scale + blur ===
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
    radial-gradient(circle at 15% 80%, rgba(139,105,60,0.10) 0%, rgba(139,105,60,0.06) 6%, transparent 13%),
    radial-gradient(circle at 85% 18%, rgba(139,105,60,0.08) 0%, rgba(139,105,60,0.04) 7%, transparent 12%)
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

  // === TITLE (focus-in blur, centered at top) ===
  const titleDelay = Math.round(1.0 * fps);
  const titleDuration = Math.round(0.7 * fps);
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
  const titleBlurVal = interpolate(titleProgress, [0, 1], [12, 0]);
  const titleScaleVal = interpolate(titleProgress, [0, 1], [1.08, 1]);

  // === TABLE LAYOUT ===
  const contentPadX = 90;
  const contentPadTop = 80;
  const tableTop = contentPadTop + 90;
  const tableLeft = contentPadX;
  const tableRight = CARD_W - contentPadX;
  const tableWidth = tableRight - tableLeft;
  const headerRowHeight = 48;
  const bodyRowHeight = 48;
  const numCols = columns.length;
  const numRows = rows.length;
  const colWidth = tableWidth / numCols;
  const tableBottom = tableTop + headerRowHeight + numRows * bodyRowHeight;

  // === GRID LINES ANIMATION (drawn like handwriting) ===
  const gridBaseDelay = Math.round(1.6 * fps);
  const hLineStagger = Math.round(0.07 * fps);
  const hLineDuration = Math.round(0.5 * fps);
  const numHLines = numRows + 1;

  const vLineBaseDelay =
    gridBaseDelay + numHLines * hLineStagger + Math.round(0.05 * fps);
  const vLineStagger = Math.round(0.1 * fps);
  const vLineDuration = Math.round(0.5 * fps);
  const numVLines = numCols - 1;

  // === HEADER CELLS (individual stagger, left to right) ===
  const headerBaseDelay =
    vLineBaseDelay + numVLines * vLineStagger + Math.round(0.08 * fps);
  const headerCellStagger = Math.round(0.08 * fps);
  const headerCellDuration = Math.round(0.3 * fps);

  // === HEADER UNDERLINES (rough.js, drawn after header text appears) ===
  const headerUnderlineDelay = headerBaseDelay + numCols * headerCellStagger;
  const headerUnderlineDuration = Math.round(0.4 * fps);
  const headerUnderlineStagger = Math.round(0.06 * fps);

  // === BODY CELLS (typewriter fill: cell-by-cell, row-by-row) ===
  const bodyCellBaseDelay =
    headerUnderlineDelay + numCols * headerUnderlineStagger + Math.round(0.1 * fps);
  const cellStagger = Math.round(0.06 * fps); // per cell within a row
  const rowGap = Math.round(0.04 * fps); // extra gap between rows
  const cellFadeDuration = Math.round(0.25 * fps);

  // Calculate the delay for each cell
  const getCellDelay = (rowIdx: number, colIdx: number): number => {
    let delay = bodyCellBaseDelay;
    // Add time for all previous rows
    for (let r = 0; r < rowIdx; r++) {
      delay += numCols * cellStagger + rowGap;
    }
    // Add time for cells in current row before this one
    delay += colIdx * cellStagger;
    return delay;
  };

  // Row background wash fade-in (starts slightly before its first cell)
  const getRowWashDelay = (rowIdx: number): number => {
    return getCellDelay(rowIdx, 0) - Math.round(0.05 * fps);
  };

  // === CAPTION ===
  const lastCellDelay = getCellDelay(numRows - 1, numCols - 1);
  const captionDelay = lastCellDelay + cellFadeDuration + Math.round(0.2 * fps);
  const captionDuration = Math.round(0.5 * fps);
  const captionProgress = caption
    ? interpolate(
        frame,
        [captionDelay, captionDelay + captionDuration],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.quad),
        },
      )
    : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgb(${bgR}, ${bgG}, ${bgB})`,
      }}
    >
      {/* SVG filters */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="datatable-paper-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.68"
              numOctaves="4"
              stitchTiles="stitch"
              result="noise"
            />
            <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
          </filter>
          <filter id="datatable-watercolor">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04"
              numOctaves="3"
              seed="5"
              result="warp"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="warp"
              scale="6"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

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

          {/* Grain noise overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 2,
              filter: "url(#datatable-paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Rough.js SVG overlay -- border, grid lines, header underlines */}
          <svg
            width={CARD_W}
            height={CARD_H}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <RoughBorder
              x={16}
              y={16}
              w={CARD_W - 32}
              h={CARD_H - 32}
              progress={borderProgress}
              seed={41}
            />

            {/* Horizontal grid lines (top-to-bottom, drawn like handwriting) */}
            {Array.from({ length: numHLines }).map((_, idx) => {
              const lineY = tableTop + headerRowHeight + idx * bodyRowHeight;
              const lineStart = gridBaseDelay + idx * hLineStagger;
              const lineProgress = interpolate(
                frame,
                [lineStart, lineStart + hLineDuration],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.cubic),
                },
              );
              return (
                <RoughDrawnLine
                  key={`h-${idx}`}
                  x1={tableLeft}
                  y1={lineY}
                  x2={tableRight}
                  y2={lineY}
                  progress={lineProgress}
                  seed={300 + idx}
                  clipId={`datatable-hline-${idx}`}
                />
              );
            })}

            {/* Vertical grid lines (left-to-right, drawn like handwriting) */}
            {Array.from({ length: numVLines }).map((_, idx) => {
              const lineX = tableLeft + (idx + 1) * colWidth;
              const lineStart = vLineBaseDelay + idx * vLineStagger;
              const lineProgress = interpolate(
                frame,
                [lineStart, lineStart + vLineDuration],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.cubic),
                },
              );
              return (
                <RoughDrawnLine
                  key={`v-${idx}`}
                  x1={lineX}
                  y1={tableTop}
                  x2={lineX}
                  y2={tableBottom}
                  progress={lineProgress}
                  seed={400 + idx}
                  clipId={`datatable-vline-${idx}`}
                />
              );
            })}

            {/* Header underlines (rough.js, one per column) */}
            {columns.map((_, idx) => {
              const ulStart = headerUnderlineDelay + idx * headerUnderlineStagger;
              const ulProgress = interpolate(
                frame,
                [ulStart, ulStart + headerUnderlineDuration],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.cubic),
                },
              );
              const ulX1 = tableLeft + idx * colWidth + 10;
              const ulX2 = tableLeft + (idx + 1) * colWidth - 10;
              const ulY = tableTop + headerRowHeight - 4;
              return (
                <RoughDrawnLine
                  key={`ul-${idx}`}
                  x1={ulX1}
                  y1={ulY}
                  x2={ulX2}
                  y2={ulY}
                  progress={ulProgress}
                  seed={600 + idx}
                  stroke="rgba(91, 76, 58, 0.35)"
                  strokeWidth={1.8}
                  roughness={1.2}
                  clipId={`datatable-ul-${idx}`}
                />
              );
            })}
          </svg>

          {/* Text content */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: `${contentPadTop}px ${contentPadX}px`,
              display: "flex",
              flexDirection: "column",
              zIndex: 1,
            }}
          >
            {/* Title -- focus-in blur, centered */}
            <div
              style={{
                fontFamily: serifFont,
                fontSize: 42,
                fontWeight: 700,
                color: "#1a1a1a",
                letterSpacing: "-0.02em",
                lineHeight: "50px",
                textAlign: "center",
                opacity: titleOpacity,
                transform: `scale(${titleScaleVal})`,
                filter:
                  titleBlurVal > 0.1 ? `blur(${titleBlurVal}px)` : undefined,
              }}
            >
              {title}
            </div>

            {/* Table */}
            <div
              style={{
                marginTop: tableTop - contentPadTop - 50,
                position: "relative",
              }}
            >
              {/* Header row -- each cell fades in individually */}
              <div
                style={{
                  display: "flex",
                  height: headerRowHeight,
                }}
              >
                {columns.map((col, idx) => {
                  const cellStart = headerBaseDelay + idx * headerCellStagger;
                  const cellProgress = interpolate(
                    frame,
                    [cellStart, cellStart + headerCellDuration],
                    [0, 1],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.out(Easing.quad),
                    },
                  );
                  const cellTranslateY = interpolate(cellProgress, [0, 1], [6, 0]);

                  return (
                    <div
                      key={idx}
                      style={{
                        width: colWidth,
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: 12,
                        paddingRight: 12,
                        fontFamily: sansFont,
                        fontSize: 14,
                        fontWeight: 600,
                        color: HEADER_COLOR,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        opacity: cellProgress,
                        transform: `translateY(${cellTranslateY}px)`,
                      }}
                    >
                      {col}
                    </div>
                  );
                })}
              </div>

              {/* Body rows -- watercolor wash backgrounds + typewriter cell fill */}
              {rows.map((row, rowIdx) => {
                const washDelay = getRowWashDelay(rowIdx);
                const washProgress = interpolate(
                  frame,
                  [washDelay, washDelay + Math.round(0.4 * fps)],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.quad),
                  },
                );
                const washColor = ROW_WASHES[rowIdx % ROW_WASHES.length];

                return (
                  <div
                    key={rowIdx}
                    style={{
                      display: "flex",
                      height: bodyRowHeight,
                      position: "relative",
                    }}
                  >
                    {/* Watercolor wash background */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: washColor,
                        opacity: washProgress,
                        filter: "url(#datatable-watercolor)",
                        borderRadius: 1,
                      }}
                    />

                    {/* Cells -- typewriter fill effect */}
                    {row.map((cell, colIdx) => {
                      const cellDelay = getCellDelay(rowIdx, colIdx);
                      const cellSpring = spring({
                        frame: Math.max(0, frame - cellDelay),
                        fps,
                        config: { damping: 18, stiffness: 120 },
                        durationInFrames: cellFadeDuration,
                      });
                      const cellOpacity = interpolate(cellSpring, [0, 1], [0, 1]);
                      const cellTranslateY = interpolate(cellSpring, [0, 1], [12, 0]);
                      const isNumeric = looksNumeric(cell);

                      return (
                        <div
                          key={colIdx}
                          style={{
                            width: colWidth,
                            display: "flex",
                            alignItems: "center",
                            paddingLeft: 12,
                            paddingRight: 12,
                            fontFamily: isNumeric ? monoFont : sansFont,
                            fontSize: 20,
                            fontWeight: 400,
                            color: "#3D3428",
                            lineHeight: "28px",
                            opacity: cellOpacity,
                            transform: `translateY(${cellTranslateY}px)`,
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          {cell}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Caption -- italic serif font */}
            {caption && (
              <div
                style={{
                  position: "absolute",
                  bottom: contentPadTop,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontFamily: serifFont,
                  fontSize: 17,
                  fontWeight: 500,
                  color: "rgba(61, 52, 40, 0.55)",
                  fontStyle: "italic",
                  opacity: captionProgress,
                  transform: `translateY(${interpolate(captionProgress, [0, 1], [10, 0])}px)`,
                  filter:
                    captionProgress < 0.95
                      ? `blur(${interpolate(captionProgress, [0, 1], [4, 0])}px)`
                      : undefined,
                }}
              >
                {caption}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
