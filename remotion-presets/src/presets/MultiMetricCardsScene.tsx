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
import { loadFont as loadIBMPlexMono } from "@remotion/google-fonts/IBMPlexMono";

const { fontFamily: serifFont } = loadFont("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const { fontFamily: sansFont } = loadInter("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
});

const { fontFamily: monoFamily } = loadIBMPlexMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const MetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  unit: z.string().optional(),
  delta: z.string().optional(),
  direction: z.enum(["up", "down"]).optional(),
});

export const MultiMetricCardsSchema = z.object({
  title: z.string(),
  metrics: z.array(MetricSchema),
});

type MultiMetricCardsProps = z.infer<typeof MultiMetricCardsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRIMARY = "#2563EB";
const CARD_W = 1600;
const CARD_H = 900;
const ACCENT_COLORS = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DC2626"];

// ─────────────────────────────────────────────────────────────────────────────
// Rough.js helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateRoughRect(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  options?: { stroke?: string; strokeWidth?: number; roughness?: number },
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
        <clipPath id={`multiMetric-divider-clip-${seed}`}>
          <rect x={x1} y={y1 - 10} width={clipWidth} height={20} />
        </clipPath>
      </defs>
      <g clipPath={`url(#multiMetric-divider-clip-${seed})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} />
        ))}
      </g>
    </g>
  );
};

const RoughMiniCardBorder: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  progress: number;
  seed: number;
}> = ({ x, y, w, h, progress, seed }) => {
  const paths = useMemo(
    () =>
      generateRoughRect(x, y, w, h, seed, {
        stroke: "rgba(0,0,0,0.12)",
        strokeWidth: 1.2,
        roughness: 1.0,
      }),
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
          stroke="rgba(0,0,0,0.12)"
          strokeWidth={1.2}
        />
      ))}
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Numeric value parsing for count-up
// ─────────────────────────────────────────────────────────────────────────────

function parseNumericValue(value: string): {
  isNumeric: boolean;
  numericPart: number;
  prefix: string;
  suffix: string;
  decimals: number;
} {
  const match = value.match(/^([^0-9\-.]*)(-?[\d,]+\.?\d*)(.*)$/);
  if (!match) {
    return { isNumeric: false, numericPart: 0, prefix: "", suffix: "", decimals: 0 };
  }
  const prefix = match[1];
  const numStr = match[2].replace(/,/g, "");
  const suffix = match[3];
  const num = parseFloat(numStr);
  if (isNaN(num)) {
    return { isNumeric: false, numericPart: 0, prefix: "", suffix: "", decimals: 0 };
  }
  const dotIndex = numStr.indexOf(".");
  const decimals = dotIndex >= 0 ? numStr.length - dotIndex - 1 : 0;
  return { isNumeric: true, numericPart: num, prefix, suffix, decimals };
}

function formatNumber(n: number, decimals: number, original: string): string {
  // Preserve comma formatting if original had commas
  const hasCommas = original.includes(",");
  let formatted = n.toFixed(decimals);
  if (hasCommas) {
    const parts = formatted.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    formatted = parts.join(".");
  }
  return formatted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const MultiMetricCardsScene: React.FC<MultiMetricCardsProps> = ({
  title,
  metrics,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const metricCount = Math.min(metrics.length, 5);

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

  // === TITLE (focus-in blur) ===
  const titleDelay = Math.round(0.7 * fps);
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

  // === DIVIDER under title ===
  const dividerDelay = Math.round(1.0 * fps);
  const dividerDuration = Math.round(0.5 * fps);
  const dividerProgress = interpolate(
    frame,
    [dividerDelay, dividerDelay + dividerDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // === METRIC CARDS ===
  // Cards fan in from center outward
  const metricCardBaseDelay = Math.round(1.2 * fps);
  const cardStagger = Math.round(0.09 * fps);

  // Sort indices by distance from center (center first)
  const centerIndex = (metricCount - 1) / 2;
  const sortedIndices = Array.from({ length: metricCount }, (_, i) => i).sort(
    (a, b) => Math.abs(a - centerIndex) - Math.abs(b - centerIndex),
  );
  const orderMap = new Map<number, number>();
  sortedIndices.forEach((idx, order) => orderMap.set(idx, order));

  // Mini card dimensions
  const cardGap = 24;
  const totalGap = cardGap * (metricCount - 1);
  const availableW = CARD_W - 160; // 80px padding each side
  const miniCardW = Math.min(260, (availableW - totalGap) / metricCount);
  const miniCardH = 280;
  const cardsStartX = (CARD_W - (miniCardW * metricCount + totalGap)) / 2;
  const cardsY = 320;

  // === COUNT-UP DURATION ===
  const countUpDuration = Math.round(0.8 * fps);

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
            <filter id="multiMetric-paper-grain">
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
              filter: "url(#multiMetric-paper-grain)",
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
              seed={91}
            />
            <RoughDivider
              x1={CARD_W / 2 - 200}
              y1={280}
              x2={CARD_W / 2 + 200}
              y2={280}
              progress={dividerProgress}
              seed={92}
              color="rgba(0, 0, 0, 0.12)"
            />
            {/* Mini card rough borders */}
            {metrics.slice(0, metricCount).map((_, i) => {
              const order = orderMap.get(i) ?? i;
              const cardDelay = metricCardBaseDelay + order * cardStagger;
              const cardEntrance = spring({
                frame,
                fps,
                delay: cardDelay,
                config: { damping: 200, stiffness: 100 },
              });
              const x = cardsStartX + i * (miniCardW + cardGap);
              return (
                <RoughMiniCardBorder
                  key={i}
                  x={x}
                  y={cardsY}
                  w={miniCardW}
                  h={miniCardH}
                  progress={cardEntrance}
                  seed={100 + i * 7}
                />
              );
            })}
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
              alignItems: "center",
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
                marginBottom: 100,
              }}
            >
              {title}
            </div>

            {/* Metric mini-cards row */}
            <div
              style={{
                display: "flex",
                gap: cardGap,
                justifyContent: "center",
                alignItems: "flex-start",
                marginTop: 40,
              }}
            >
              {metrics.slice(0, metricCount).map((metric, i) => {
                const order = orderMap.get(i) ?? i;
                const cardDelay = metricCardBaseDelay + order * cardStagger;

                const cardEntrance = spring({
                  frame,
                  fps,
                  delay: cardDelay,
                  config: { damping: 200, stiffness: 100 },
                });

                const cardScale = interpolate(cardEntrance, [0, 1], [0.9, 1]);
                const cardOpacity = interpolate(cardEntrance, [0, 1], [0, 1]);

                // Rotation: left cards -2 -> 0, right cards +2 -> 0
                const side = i - centerIndex;
                const rotationStart = side < 0 ? -2 : side > 0 ? 2 : 0;
                const cardRotation = interpolate(cardEntrance, [0, 1], [rotationStart, 0]);

                // Accent color top border draw-in
                const accentDelay = cardDelay + Math.round(0.3 * fps);
                const accentProgress = interpolate(
                  frame,
                  [accentDelay, accentDelay + Math.round(0.4 * fps)],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) },
                );

                // Count-up for numeric values
                const countUpDelay = cardDelay + Math.round(0.2 * fps);
                const parsed = parseNumericValue(metric.value);
                let displayValue = metric.value;
                if (parsed.isNumeric) {
                  const countProgress = interpolate(
                    frame,
                    [countUpDelay, countUpDelay + countUpDuration],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) },
                  );
                  const currentNum = interpolate(countProgress, [0, 1], [0, parsed.numericPart]);
                  displayValue = parsed.prefix + formatNumber(currentNum, parsed.decimals, metric.value) + parsed.suffix;
                } else {
                  // Non-numeric: just fade in
                  const fadeProgress = interpolate(
                    frame,
                    [countUpDelay, countUpDelay + Math.round(0.4 * fps)],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  );
                  displayValue = fadeProgress > 0.01 ? metric.value : "";
                }

                // Delta badge bounce
                const deltaDelay = cardDelay + Math.round(0.8 * fps);
                const deltaBounce = spring({
                  frame,
                  fps,
                  delay: deltaDelay,
                  config: { damping: 12, stiffness: 200, mass: 0.5 },
                });
                const deltaScale = interpolate(deltaBounce, [0, 1], [0, 1]);
                const deltaOpacity = interpolate(deltaBounce, [0, 1], [0, 1]);

                const accentColor = ACCENT_COLORS[i % ACCENT_COLORS.length];

                return (
                  <div
                    key={i}
                    style={{
                      width: miniCardW,
                      height: miniCardH,
                      opacity: cardOpacity,
                      transform: `scale(${cardScale}) rotate(${cardRotation}deg)`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px 16px",
                      position: "relative",
                    }}
                  >
                    {/* Accent color top border */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}AA)`,
                        transformOrigin: "left center",
                        transform: `scaleX(${accentProgress})`,
                        borderRadius: "2px 2px 0 0",
                      }}
                    />

                    {/* Value */}
                    <div
                      style={{
                        fontFamily: monoFamily,
                        fontSize: 48,
                        fontWeight: 700,
                        color: "#1a1a1a",
                        letterSpacing: "-0.02em",
                        lineHeight: "56px",
                        textAlign: "center",
                        marginBottom: 4,
                      }}
                    >
                      {displayValue}
                    </div>

                    {/* Unit */}
                    {metric.unit && (
                      <div
                        style={{
                          fontFamily: sansFont,
                          fontSize: 16,
                          fontWeight: 400,
                          color: "#999",
                          textAlign: "center",
                          marginBottom: 12,
                        }}
                      >
                        {metric.unit}
                      </div>
                    )}

                    {/* Label */}
                    <div
                      style={{
                        fontFamily: sansFont,
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#555",
                        textAlign: "center",
                        lineHeight: "24px",
                        marginBottom: metric.delta ? 12 : 0,
                        marginTop: metric.unit ? 0 : 12,
                      }}
                    >
                      {metric.label}
                    </div>

                    {/* Delta badge */}
                    {metric.delta && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 12px",
                          borderRadius: 999,
                          backgroundColor:
                            metric.direction === "down"
                              ? "rgba(220, 38, 38, 0.1)"
                              : "rgba(5, 150, 105, 0.1)",
                          transform: `scale(${deltaScale})`,
                          opacity: deltaOpacity,
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          {metric.direction === "down" ? (
                            <path
                              d="M6 2.5V9.5M6 9.5L3 6.5M6 9.5L9 6.5"
                              stroke="#DC2626"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ) : (
                            <path
                              d="M6 9.5V2.5M6 2.5L3 5.5M6 2.5L9 5.5"
                              stroke="#059669"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                        </svg>
                        <span
                          style={{
                            fontFamily: sansFont,
                            fontSize: 13,
                            fontWeight: 600,
                            color:
                              metric.direction === "down"
                                ? "#DC2626"
                                : "#059669",
                          }}
                        >
                          {metric.delta}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
