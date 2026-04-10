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
import { loadFont } from "@remotion/google-fonts/Caveat";

const { fontFamily: caveatFont } = loadFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

// ── Schema ───────────────────────────────────────────────────────────────────

export const HorizontalBarChartSchema = z.object({
  title: z.string(),
  labels: z.array(z.string()),
  values: z.array(z.number()),
  highlightLabel: z.string().optional(),
});

type Props = z.infer<typeof HorizontalBarChartSchema>;

// ── Seeded noise helpers ─────────────────────────────────────────────────────

function seededNoise(seed: number): number {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

function wobble(seed: number, amplitude = 2): number {
  return (seededNoise(seed) - 0.5) * 2 * amplitude;
}

// ── Wobbly path helpers ──────────────────────────────────────────────────────

function wobblyRect(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
): string {
  const jitter = (s: number, a = 2) => wobble(s, a);
  const x1 = x + jitter(seed + 1);
  const y1 = y + jitter(seed + 2);
  const x2 = x + w + jitter(seed + 3);
  const y2 = y + jitter(seed + 4);
  const x3 = x + w + jitter(seed + 5);
  const y3 = y + h + jitter(seed + 6);
  const x4 = x + jitter(seed + 7);
  const y4 = y + h + jitter(seed + 8);

  const mxTop = (x1 + x2) / 2 + jitter(seed + 10, 3);
  const myTop = (y1 + y2) / 2 + jitter(seed + 11, 3);
  const mxRight = (x2 + x3) / 2 + jitter(seed + 12, 3);
  const myRight = (y2 + y3) / 2 + jitter(seed + 13, 3);
  const mxBottom = (x3 + x4) / 2 + jitter(seed + 14, 3);
  const myBottom = (y3 + y4) / 2 + jitter(seed + 15, 3);
  const mxLeft = (x4 + x1) / 2 + jitter(seed + 16, 3);
  const myLeft = (y4 + y1) / 2 + jitter(seed + 17, 3);

  return [
    `M ${x1} ${y1}`,
    `Q ${mxTop} ${myTop} ${x2} ${y2}`,
    `Q ${mxRight} ${myRight} ${x3} ${y3}`,
    `Q ${mxBottom} ${myBottom} ${x4} ${y4}`,
    `Q ${mxLeft} ${myLeft} ${x1} ${y1}`,
    "Z",
  ].join(" ");
}

// ── Rough.js helpers ─────────────────────────────────────────────────────────

function generateRoughRect(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  options?: { stroke?: string; strokeWidth?: number },
): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.rectangle(x, y, w, h, {
    roughness: 0.8,
    bowing: 1,
    seed,
    stroke: options?.stroke || "rgba(0, 0, 0, 0.08)",
    strokeWidth: options?.strokeWidth || 1.5,
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

// ── Scribble fill pattern ────────────────────────────────────────────────────

const ScribbleFill: React.FC<{
  id: string;
  color: string;
}> = ({ id, color }) => {
  return (
    <defs>
      <pattern
        id={id}
        patternUnits="userSpaceOnUse"
        width="6"
        height="6"
        patternTransform="rotate(40)"
      >
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="6"
          stroke={color}
          strokeWidth="3.5"
          strokeOpacity="0.85"
        />
      </pattern>
    </defs>
  );
};

// ── Constants ────────────────────────────────────────────────────────────────

const CARD_W = 1400;
const CARD_H = 880;

// ── Main Scene ───────────────────────────────────────────────────────────────

export const HorizontalBarChartScene: React.FC<Props> = ({
  title,
  labels,
  values,
  highlightLabel,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Sort by value descending
  const sortedData = useMemo(() => {
    const paired = labels.map((label, i) => ({
      label,
      value: values[i] ?? 0,
    }));
    return paired.sort((a, b) => b.value - a.value);
  }, [labels, values]);

  const maxValue = Math.max(...sortedData.map((d) => d.value), 1);

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

  // === Title animation ===
  const titleAlpha = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 18], [30, 52], {
    easing: Easing.out(Easing.quad),
    extrapolateRight: "clamp",
  });

  // === Bar layout ===
  const BAR_PAD_LEFT = 180;
  const BAR_PAD_RIGHT = 80;
  const BAR_PAD_TOP = 80;
  const BAR_PAD_BOTTOM = 40;

  const barAreaW = CARD_W - BAR_PAD_LEFT - BAR_PAD_RIGHT;
  const barAreaH = CARD_H - BAR_PAD_TOP - BAR_PAD_BOTTOM;
  const barSpacing = barAreaH / sortedData.length;
  const barH = barSpacing * 0.55;

  // Highlight rough outline (memoized)
  const highlightIndex = sortedData.findIndex(
    (d) => d.label === highlightLabel,
  );
  const highlightOutlinePaths = useMemo(() => {
    if (highlightIndex < 0) return [];
    const hy = BAR_PAD_TOP + highlightIndex * barSpacing + (barSpacing - barH) / 2;
    return generateRoughRect(
      BAR_PAD_LEFT - 10,
      hy - 6,
      barAreaW + 20,
      barH + 12,
      777,
      { stroke: "#059669", strokeWidth: 2 },
    );
  }, [highlightIndex, barSpacing, barH, barAreaW]);

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
            <filter id="hbar-paper-grain">
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
              filter: "url(#hbar-paper-grain)",
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

            {/* Title */}
            <text
              x={CARD_W / 2 + wobble(999)}
              y={titleY}
              textAnchor="middle"
              fontFamily={caveatFont}
              fontSize="36"
              fontWeight="bold"
              fill="#333"
              opacity={titleAlpha}
            >
              {title}
            </text>

            {/* Bars */}
            {sortedData.map((item, i) => {
              const isHighlight = item.label === highlightLabel;
              const barColor = isHighlight ? "#059669" : "#D1D5DB";
              const seed = i * 100;
              const STAGGER = 4;

              // Label fade in (staggered top to bottom)
              const labelDelay = 0.5 * fps + i * 3;
              const labelAlpha = interpolate(
                frame,
                [labelDelay, labelDelay + 10],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                },
              );

              // Bar grow (spring, staggered)
              const barDelay = 0.7 * fps + i * STAGGER;
              const barProgress = spring({
                frame,
                fps,
                delay: barDelay,
                config: { damping: 12, stiffness: 100, mass: 1, overshootClamping: false },
              });

              const barW = barProgress * (item.value / maxValue) * barAreaW;
              const barY =
                BAR_PAD_TOP + i * barSpacing + (barSpacing - barH) / 2;
              const barX = BAR_PAD_LEFT;

              // Value fade in (after bar grows)
              const valueAlpha = interpolate(barProgress, [0.85, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              const patternId = `hbar-scribble-${i}`;

              return (
                <g key={item.label}>
                  <ScribbleFill id={patternId} color={barColor} />

                  {/* Label */}
                  <text
                    x={BAR_PAD_LEFT - 14 + wobble(seed + 400, 1)}
                    y={barY + barH / 2 + 5 + wobble(seed + 401, 1)}
                    textAnchor="end"
                    fontFamily={caveatFont}
                    fontSize="22"
                    fill="#555"
                    opacity={labelAlpha}
                  >
                    {item.label}
                  </text>

                  {/* Bar shadow */}
                  {barW > 1 && (
                    <path
                      d={wobblyRect(barX + 3, barY + 3, barW, barH, seed + 50)}
                      fill="rgba(0,0,0,0.08)"
                    />
                  )}

                  {/* Bar fill */}
                  {barW > 1 && (
                    <path
                      d={wobblyRect(barX, barY, barW, barH, seed)}
                      fill={`url(#${patternId})`}
                    />
                  )}

                  {/* Bar outline */}
                  {barW > 1 && (
                    <path
                      d={wobblyRect(barX, barY, barW, barH, seed + 200)}
                      fill="none"
                      stroke={barColor}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Value at bar tip */}
                  <text
                    x={barX + barW + 12 + wobble(seed + 500, 1)}
                    y={barY + barH / 2 + 6 + wobble(seed + 501, 1)}
                    textAnchor="start"
                    fontFamily={caveatFont}
                    fontSize="22"
                    fontWeight="bold"
                    fill={isHighlight ? "#059669" : "#777"}
                    opacity={valueAlpha}
                  >
                    {item.value}
                  </text>
                </g>
              );
            })}

            {/* Highlight outline */}
            {highlightIndex >= 0 &&
              (() => {
                const hlDelay =
                  0.7 * fps + highlightIndex * 4 + 9;
                const hlAlpha = interpolate(
                  frame,
                  [hlDelay, hlDelay + 12],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );
                return (
                  <g opacity={hlAlpha}>
                    {highlightOutlinePaths.map((d, i) => (
                      <path
                        key={i}
                        d={d}
                        fill="none"
                        stroke="#059669"
                        strokeWidth={2}
                        opacity={0.6}
                      />
                    ))}
                  </g>
                );
              })()}
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};
