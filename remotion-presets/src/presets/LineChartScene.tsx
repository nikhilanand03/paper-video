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

// ── Schema ───────────────────────────────────────────────────────────────────

const DatasetSchema = z.object({
  label: z.string(),
  values: z.array(z.number()),
});

export const LineChartSchema = z.object({
  title: z.string(),
  labels: z.array(z.string()),
  datasets: z.array(DatasetSchema),
});

// ── Seeded noise helper (deterministic) ───────────────────────────────────────

function seededNoise(seed: number): number {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

function wobble(seed: number, amplitude = 2): number {
  return (seededNoise(seed) - 0.5) * 2 * amplitude;
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

function generateRoughCircle(
  cx: number,
  cy: number,
  diameter: number,
  seed: number,
  color: string,
): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.circle(cx, cy, diameter, {
    roughness: 1,
    bowing: 1,
    seed,
    stroke: color,
    strokeWidth: 2,
    fill: color,
    fillStyle: "solid",
    fillWeight: 1,
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

const RoughDot: React.FC<{
  cx: number;
  cy: number;
  diameter: number;
  seed: number;
  color: string;
  scale: number;
}> = ({ cx, cy, diameter, seed, color, scale }) => {
  const paths = useMemo(
    () => generateRoughCircle(cx, cy, diameter, seed, color),
    [cx, cy, diameter, seed, color],
  );
  if (paths.length === 0 || scale <= 0) return null;
  return (
    <g
      style={{
        transform: `translate(${cx}px, ${cy}px) scale(${scale}) translate(${-cx}px, ${-cy}px)`,
        transformOrigin: `${cx}px ${cy}px`,
      }}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} fill={color} stroke={color} strokeWidth={2} />
      ))}
    </g>
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
const LINE_COLORS = ["#2563EB", "#DC2626", "#059669", "#D97706", "#7C3AED"];

// ── Main Scene ────────────────────────────────────────────────────────────────

type Props = z.infer<typeof LineChartSchema>;

export const LineChartScene: React.FC<Props> = ({ title, labels, datasets }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // === Compute min/max ===
  const allValues = datasets.flatMap((ds) => ds.values);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const padding = (dataMax - dataMin) * 0.1 || 10;
  const yMin = Math.floor(dataMin - padding);
  const yMax = Math.ceil(dataMax + padding);
  const yRange = yMax - yMin;

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

  // === Chart layout ===
  const CHART_PAD_LEFT = 80;
  const CHART_PAD_RIGHT = 40;
  const CHART_PAD_TOP = 80;
  const CHART_PAD_BOTTOM = 70;

  const chartX = CHART_PAD_LEFT;
  const chartY = CHART_PAD_TOP;
  const chartW = CARD_W - CHART_PAD_LEFT - CHART_PAD_RIGHT;
  const chartH = CARD_H - CHART_PAD_TOP - CHART_PAD_BOTTOM;

  const numLabels = labels.length;

  // Map data value to pixel Y
  const valueToY = (v: number) =>
    chartY + chartH - ((v - yMin) / yRange) * chartH;
  // Map index to pixel X
  const indexToX = (i: number) =>
    chartX + (i / Math.max(numLabels - 1, 1)) * chartW;

  // === Y-axis ticks ===
  const numTicks = 5;
  const tickStep = yRange / numTicks;
  const yTicks: number[] = [];
  for (let i = 0; i <= numTicks; i++) {
    yTicks.push(Math.round((yMin + i * tickStep) * 100) / 100);
  }

  const tickAlpha = spring({ frame, fps, config: { damping: 200 }, delay: 18 });

  // === X-axis labels ===
  const xLabelAlpha = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 20,
  });

  // === Line data as points ===
  const lineData = datasets.map((ds, dsIdx) => {
    const points = ds.values.map((v, i) => ({
      px: indexToX(i) + wobble(dsIdx * 1000 + i * 10 + 1, 1.5),
      py: valueToY(v) + wobble(dsIdx * 1000 + i * 10 + 2, 1.5),
      value: v,
    }));
    return { ...ds, points, color: LINE_COLORS[dsIdx % LINE_COLORS.length] };
  });

  // === Build wobbly path string for each dataset ===
  const buildWobblyPath = (
    points: { px: number; py: number }[],
  ): string => {
    if (points.length === 0) return "";
    let d = `M ${points[0].px} ${points[0].py}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].px} ${points[i].py}`;
    }
    return d;
  };

  // Compute total path length approximation
  const pathLength = (points: { px: number; py: number }[]): number => {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].px - points[i - 1].px;
      const dy = points[i].py - points[i - 1].py;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  };

  // Compute cumulative lengths for each point
  const cumulativeLengths = (
    points: { px: number; py: number }[],
  ): number[] => {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].px - points[i - 1].px;
      const dy = points[i].py - points[i - 1].py;
      lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    return lengths;
  };

  // === Legend ===
  const showLegend = datasets.length > 1;
  const legendAlpha = interpolate(frame, [10, 22], [0, 1], {
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
            <filter id="linechart-paper-grain">
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
              filter: "url(#linechart-paper-grain)",
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

            <ChartTitle
              frame={frame}
              fps={fps}
              width={CARD_W}
              title={title}
            />

            {/* Legend */}
            {showLegend && (
              <g opacity={legendAlpha}>
                {lineData.map((ds, i) => {
                  const lx = CARD_W / 2 - (lineData.length * 100) / 2 + i * 100;
                  return (
                    <g key={ds.label}>
                      <line
                        x1={lx}
                        y1={68}
                        x2={lx + 24}
                        y2={68}
                        stroke={ds.color}
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                      <circle cx={lx + 12} cy={68} r={4} fill={ds.color} />
                      <text
                        x={lx + 30}
                        y={72}
                        fontFamily="'Caveat', 'Comic Sans MS', cursive"
                        fontSize="18"
                        fill="#555"
                      >
                        {ds.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Y-axis ticks */}
            <g opacity={tickAlpha}>
              {yTicks.map((t, i) => {
                const y = valueToY(t);
                return (
                  <g key={i}>
                    <line
                      x1={chartX - 8 + wobble(t * 7 + 500, 2)}
                      y1={y + wobble(t * 7 + 501, 1)}
                      x2={chartX + wobble(t * 7 + 502, 2)}
                      y2={y + wobble(t * 7 + 503, 1)}
                      stroke="#888"
                      strokeWidth="2"
                    />
                    <text
                      x={chartX - 14 + wobble(t * 7 + 504)}
                      y={y + 7 + wobble(t * 7 + 505, 2)}
                      textAnchor="end"
                      fontFamily="'Caveat', 'Comic Sans MS', cursive"
                      fontSize="18"
                      fill="#777"
                    >
                      {Math.round(t)}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* X-axis labels */}
            <g opacity={xLabelAlpha}>
              {labels.map((label, i) => {
                const x = indexToX(i);
                return (
                  <text
                    key={i}
                    x={x + wobble(i * 13 + 600)}
                    y={chartY + chartH + 32 + wobble(i * 13 + 601, 2)}
                    textAnchor="middle"
                    fontFamily="'Caveat', 'Comic Sans MS', cursive"
                    fontSize="20"
                    fill="#555"
                  >
                    {label}
                  </text>
                );
              })}
            </g>

            <Axis
              chartX={chartX}
              chartY={chartY}
              chartW={chartW}
              chartH={chartH}
              frame={frame}
              fps={fps}
            />

            {/* Lines and points */}
            {lineData.map((ds, dsIdx) => {
              const STAGGER_DS = 7;
              const lineDelay = 9 + dsIdx * STAGGER_DS;
              const lineDrawDuration = 20;

              const lineProgress = interpolate(
                frame,
                [lineDelay, lineDelay + lineDrawDuration],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

              const totalLen = pathLength(ds.points);
              const cumLens = cumulativeLengths(ds.points);
              const dashOffset = totalLen * (1 - lineProgress);
              const pathD = buildWobblyPath(ds.points);

              return (
                <g key={ds.label}>
                  {/* Line with stroke-dasharray animation */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={ds.color}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={totalLen}
                    strokeDashoffset={dashOffset}
                  />

                  {/* Points pop in as line reaches them */}
                  {ds.points.map((pt, ptIdx) => {
                    // Point appears when the line has drawn past it
                    const pointFraction =
                      totalLen > 0 ? cumLens[ptIdx] / totalLen : 0;
                    const pointVisible = lineProgress >= pointFraction;

                    const pointScale = pointVisible
                      ? spring({
                          frame: frame - (lineDelay + Math.floor(pointFraction * lineDrawDuration)),
                          fps,
                          config: { damping: 10, stiffness: 200, mass: 0.5 },
                        })
                      : 0;

                    return (
                      <g key={ptIdx}>
                        <RoughDot
                          cx={pt.px}
                          cy={pt.py}
                          diameter={12}
                          seed={dsIdx * 500 + ptIdx * 37}
                          color={ds.color}
                          scale={pointScale}
                        />
                        {/* Value label above point */}
                        {pointScale > 0.8 && (
                          <text
                            x={pt.px + wobble(dsIdx * 500 + ptIdx * 37 + 300)}
                            y={
                              pt.py -
                              12 +
                              wobble(dsIdx * 500 + ptIdx * 37 + 301, 2)
                            }
                            textAnchor="middle"
                            fontFamily="'Caveat', 'Comic Sans MS', cursive"
                            fontSize="16"
                            fontWeight="bold"
                            fill={ds.color}
                            opacity={interpolate(pointScale, [0.8, 1], [0, 1], {
                              extrapolateLeft: "clamp",
                              extrapolateRight: "clamp",
                            })}
                          >
                            {pt.value}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};
