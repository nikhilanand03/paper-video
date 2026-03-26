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

export const BarChartSchema = z.object({
  title: z.string(),
  data: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      color: z.string(),
    }),
  ),
  maxValue: z.number().optional(),
});

// ── Seeded noise helper (deterministic) ───────────────────────────────────────

function seededNoise(seed: number): number {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

function wobble(seed: number, amplitude = 2): number {
  return (seededNoise(seed) - 0.5) * 2 * amplitude;
}

// ── Wobbly path helpers ───────────────────────────────────────────────────────

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

// ── Rough.js helpers ──────────────────────────────────────────────────────────

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

// ── Scribble fill pattern component ──────────────────────────────────────────

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

// ── Axis component ────────────────────────────────────────────────────────────

const Axis: React.FC<{
  chartX: number;
  chartY: number;
  chartW: number;
  chartH: number;
  frame: number;
  fps: number;
}> = ({ chartX, chartY, chartW, chartH, frame, fps }) => {
  const axisProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 20,
  });

  const yAxisLength = axisProgress * chartH;
  const xAxisLength = axisProgress * chartW;

  const yPath = `M ${chartX} ${chartY}
    Q ${chartX + wobble(101, 3)} ${chartY + yAxisLength * 0.33}
      ${chartX + wobble(102, 2)} ${chartY + yAxisLength * 0.66}
    Q ${chartX + wobble(103, 3)} ${chartY + yAxisLength * 0.85}
      ${chartX} ${chartY + yAxisLength}`;

  const xEnd = chartX + xAxisLength;
  const xPath = `M ${chartX} ${chartY + chartH}
    Q ${chartX + xAxisLength * 0.33} ${chartY + chartH + wobble(201, 3)}
      ${chartX + xAxisLength * 0.66} ${chartY + chartH + wobble(202, 2)}
    Q ${chartX + xAxisLength * 0.85} ${chartY + chartH + wobble(203, 3)}
      ${xEnd} ${chartY + chartH + wobble(204, 2)}`;

  return (
    <g>
      <path
        d={yPath}
        fill="none"
        stroke="#444"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {axisProgress > 0.95 && (
        <polygon
          points={`${chartX},${chartY - 10} ${chartX - 6},${chartY + 5} ${chartX + 6},${chartY + 5}`}
          fill="#444"
        />
      )}
      <path
        d={xPath}
        fill="none"
        stroke="#444"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {axisProgress > 0.95 && (
        <polygon
          points={`${xEnd + 10},${chartY + chartH} ${xEnd - 5},${chartY + chartH - 6} ${xEnd - 5},${chartY + chartH + 6}`}
          fill="#444"
        />
      )}
    </g>
  );
};

// ── Bar component ─────────────────────────────────────────────────────────────

const Bar: React.FC<{
  index: number;
  label: string;
  value: number;
  color: string;
  x: number;
  barW: number;
  baseY: number;
  maxBarH: number;
  maxValue: number;
  frame: number;
  fps: number;
}> = ({
  index,
  label,
  value,
  color,
  x,
  barW,
  baseY,
  maxBarH,
  maxValue,
  frame,
  fps,
}) => {
  const STAGGER = 8;
  const delay = 15 + index * STAGGER;

  const progress = spring({
    frame,
    fps,
    delay,
    config: { damping: 12, stiffness: 120, mass: 1 },
  });

  const barH = progress * (value / maxValue) * maxBarH;
  const barY = baseY - barH;
  const patternId = `scribble-${index}`;
  const seed = index * 100;

  const labelAlpha = interpolate(progress, [0.85, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (barH < 1) return null;

  return (
    <g>
      <ScribbleFill id={patternId} color={color} />
      <path
        d={wobblyRect(x + 4, barY + 4, barW, barH, seed + 50)}
        fill="rgba(0,0,0,0.10)"
      />
      <path
        d={wobblyRect(x, barY, barW, barH, seed)}
        fill={`url(#${patternId})`}
      />
      <path
        d={wobblyRect(x, barY, barW, barH, seed + 200)}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x={x + barW / 2 + wobble(seed + 300)}
        y={barY - 10 + wobble(seed + 301, 2)}
        textAnchor="middle"
        fontFamily="'Caveat', 'Comic Sans MS', cursive"
        fontSize="22"
        fontWeight="bold"
        fill={color}
        opacity={labelAlpha}
      >
        {value}
      </text>
      <text
        x={x + barW / 2 + wobble(seed + 400)}
        y={baseY + 32 + wobble(seed + 401, 2)}
        textAnchor="middle"
        fontFamily="'Caveat', 'Comic Sans MS', cursive"
        fontSize="22"
        fill="#555"
      >
        {label}
      </text>
    </g>
  );
};

// ── Y-axis tick labels ────────────────────────────────────────────────────────

const YTicks: React.FC<{
  chartX: number;
  chartY: number;
  chartH: number;
  frame: number;
  fps: number;
}> = ({ chartX, chartY, chartH, frame, fps }) => {
  const ticks = [0, 25, 50, 75, 100];
  const alpha = spring({ frame, fps, config: { damping: 200 }, delay: 18 });

  return (
    <g opacity={alpha}>
      {ticks.map((t) => {
        const y = chartY + chartH - (t / 100) * chartH;
        return (
          <g key={t}>
            <line
              x1={chartX - 8 + wobble(t + 500, 2)}
              y1={y + wobble(t + 501, 1)}
              x2={chartX + wobble(t + 502, 2)}
              y2={y + wobble(t + 503, 1)}
              stroke="#888"
              strokeWidth="2"
            />
            <text
              x={chartX - 14 + wobble(t + 504)}
              y={y + 7 + wobble(t + 505, 2)}
              textAnchor="end"
              fontFamily="'Caveat', 'Comic Sans MS', cursive"
              fontSize="18"
              fill="#777"
            >
              {t}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// ── Title ─────────────────────────────────────────────────────────────────────

const ChartTitle: React.FC<{
  frame: number;
  fps: number;
  width: number;
  title: string;
}> = ({ frame, fps, width, title }) => {
  const alpha = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, 18], [30, 52], {
    easing: Easing.out(Easing.quad),
    extrapolateRight: "clamp",
  });

  return (
    <text
      x={width / 2 + wobble(999)}
      y={y}
      textAnchor="middle"
      fontFamily="'Caveat', 'Comic Sans MS', cursive"
      fontSize="36"
      fontWeight="bold"
      fill="#333"
      opacity={alpha}
    >
      {title}
    </text>
  );
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_W = 1400;
const CARD_H = 880;

// ── Main Scene ────────────────────────────────────────────────────────────────

type Props = z.infer<typeof BarChartSchema>;

export const BarChartScene: React.FC<Props> = ({
  title,
  data,
  maxValue = 100,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // === CARD ENTRANCE (0–2s): Scale + blur ===
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

  // === Chart layout (relative to card) ===
  const CHART_PAD_LEFT = 80;
  const CHART_PAD_RIGHT = 40;
  const CHART_PAD_TOP = 80;
  const CHART_PAD_BOTTOM = 70;

  const chartX = CHART_PAD_LEFT;
  const chartY = CHART_PAD_TOP;
  const chartW = CARD_W - CHART_PAD_LEFT - CHART_PAD_RIGHT;
  const chartH = CARD_H - CHART_PAD_TOP - CHART_PAD_BOTTOM;

  const numBars = data.length;
  const barGap = chartW / numBars;
  const barW = barGap * 0.55;
  const baseY = chartY + chartH;

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
            <filter id="barchart-paper-grain">
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
              filter: "url(#barchart-paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Chart SVG — positioned inside the card */}
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

            <ChartTitle
              frame={frame}
              fps={fps}
              width={CARD_W}
              title={title}
            />

            <YTicks
              chartX={chartX}
              chartY={chartY}
              chartH={chartH}
              frame={frame}
              fps={fps}
            />

            <Axis
              chartX={chartX}
              chartY={chartY}
              chartW={chartW}
              chartH={chartH}
              frame={frame}
              fps={fps}
            />

            {data.map((bar, i) => {
              const x = chartX + i * barGap + (barGap - barW) / 2;
              return (
                <Bar
                  key={bar.label}
                  index={i}
                  label={bar.label}
                  value={bar.value}
                  color={bar.color}
                  x={x}
                  barW={barW}
                  baseY={baseY}
                  maxBarH={chartH}
                  maxValue={maxValue}
                  frame={frame}
                  fps={fps}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};
