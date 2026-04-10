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

const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
  label: z.string().optional(),
});

const GroupSchema = z.object({
  label: z.string(),
  points: z.array(PointSchema),
});

export const ScatterPlotSchema = z.object({
  title: z.string(),
  groups: z.array(GroupSchema),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
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
    roughness: 1.2,
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
  translateY: number;
}> = ({ cx, cy, diameter, seed, color, scale, translateY }) => {
  const paths = useMemo(
    () => generateRoughCircle(cx, cy, diameter, seed, color),
    [cx, cy, diameter, seed, color],
  );
  if (paths.length === 0 || scale <= 0) return null;
  return (
    <g
      style={{
        transform: `translate(0px, ${translateY}px) translate(${cx}px, ${cy}px) scale(${scale}) translate(${-cx}px, ${-cy}px)`,
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
const GROUP_COLORS = ["#7C3AED", "#2563EB", "#059669", "#D97706"];

// ── Main Scene ────────────────────────────────────────────────────────────────

type Props = z.infer<typeof ScatterPlotSchema>;

export const ScatterPlotScene: React.FC<Props> = ({
  title,
  groups,
  xLabel,
  yLabel,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // === Compute min/max with padding ===
  const allPoints = groups.flatMap((g) => g.points);
  const allX = allPoints.map((p) => p.x);
  const allY = allPoints.map((p) => p.y);
  const dataXMin = Math.min(...allX);
  const dataXMax = Math.max(...allX);
  const dataYMin = Math.min(...allY);
  const dataYMax = Math.max(...allY);
  const xPad = (dataXMax - dataXMin) * 0.1 || 10;
  const yPad = (dataYMax - dataYMin) * 0.1 || 10;
  const xMin = Math.floor(dataXMin - xPad);
  const xMax = Math.ceil(dataXMax + xPad);
  const yMin = Math.floor(dataYMin - yPad);
  const yMax = Math.ceil(dataYMax + yPad);
  const xRange = xMax - xMin;
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

  // Map data to pixel coords
  const dataToPixelX = (v: number) => chartX + ((v - xMin) / xRange) * chartW;
  const dataToPixelY = (v: number) =>
    chartY + chartH - ((v - yMin) / yRange) * chartH;

  // === Y-axis ticks ===
  const numYTicks = 5;
  const yTickStep = yRange / numYTicks;
  const yTicks: number[] = [];
  for (let i = 0; i <= numYTicks; i++) {
    yTicks.push(Math.round((yMin + i * yTickStep) * 100) / 100);
  }

  // === X-axis ticks ===
  const numXTicks = 5;
  const xTickStep = xRange / numXTicks;
  const xTicks: number[] = [];
  for (let i = 0; i <= numXTicks; i++) {
    xTicks.push(Math.round((xMin + i * xTickStep) * 100) / 100);
  }

  const tickAlpha = spring({ frame, fps, config: { damping: 200 }, delay: 18 });

  // === Legend ===
  const showLegend = groups.length > 1;
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
            <filter id="scatterplot-paper-grain">
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
              filter: "url(#scatterplot-paper-grain)",
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
              seed={42}
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
                {groups.map((g, i) => {
                  const color =
                    GROUP_COLORS[i % GROUP_COLORS.length];
                  const lx =
                    CARD_W / 2 - (groups.length * 110) / 2 + i * 110;
                  return (
                    <g key={g.label}>
                      <circle cx={lx + 8} cy={68} r={5} fill={color} />
                      <text
                        x={lx + 20}
                        y={72}
                        fontFamily="'Caveat', 'Comic Sans MS', cursive"
                        fontSize="18"
                        fill="#555"
                      >
                        {g.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Y-axis ticks */}
            <g opacity={tickAlpha}>
              {yTicks.map((t, i) => {
                const y = dataToPixelY(t);
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

            {/* X-axis ticks */}
            <g opacity={tickAlpha}>
              {xTicks.map((t, i) => {
                const x = dataToPixelX(t);
                return (
                  <g key={i}>
                    <line
                      x1={x + wobble(t * 11 + 700, 1)}
                      y1={chartY + chartH + wobble(t * 11 + 701, 2)}
                      x2={x + wobble(t * 11 + 702, 1)}
                      y2={chartY + chartH + 8 + wobble(t * 11 + 703, 2)}
                      stroke="#888"
                      strokeWidth="2"
                    />
                    <text
                      x={x + wobble(t * 11 + 704)}
                      y={chartY + chartH + 26 + wobble(t * 11 + 705, 2)}
                      textAnchor="middle"
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

            {/* Axis labels */}
            {xLabel && (
              <text
                x={chartX + chartW / 2}
                y={chartY + chartH + 55}
                textAnchor="middle"
                fontFamily="'Caveat', 'Comic Sans MS', cursive"
                fontSize="22"
                fill="#555"
                opacity={tickAlpha}
              >
                {xLabel}
              </text>
            )}
            {yLabel && (
              <text
                x={chartX - 55}
                y={chartY + chartH / 2}
                textAnchor="middle"
                fontFamily="'Caveat', 'Comic Sans MS', cursive"
                fontSize="22"
                fill="#555"
                opacity={tickAlpha}
                transform={`rotate(-90, ${chartX - 55}, ${chartY + chartH / 2})`}
              >
                {yLabel}
              </text>
            )}

            <Axis
              chartX={chartX}
              chartY={chartY}
              chartW={chartW}
              chartH={chartH}
              frame={frame}
              fps={fps}
            />

            {/* Scatter points - rain in from above */}
            {groups.map((group, gIdx) => {
              const color = GROUP_COLORS[gIdx % GROUP_COLORS.length];
              const GROUP_STAGGER = 9;
              const POINT_STAGGER = 2;
              const groupDelay = 9 + gIdx * GROUP_STAGGER;

              return (
                <g key={group.label}>
                  {group.points.map((pt, ptIdx) => {
                    const pointDelay = groupDelay + ptIdx * POINT_STAGGER;
                    const px = dataToPixelX(pt.x);
                    const py = dataToPixelY(pt.y);

                    // Bounce spring for drop-in
                    const dropProgress = spring({
                      frame: frame - pointDelay,
                      fps,
                      config: { damping: 10, stiffness: 120, mass: 0.8 },
                    });

                    // Point starts above and drops down
                    const dropOffset = interpolate(
                      dropProgress,
                      [0, 1],
                      [-80, 0],
                    );

                    const pointScale = interpolate(
                      dropProgress,
                      [0, 0.3, 1],
                      [0, 1, 1],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      },
                    );

                    // Label fades in after point lands
                    const labelAlpha =
                      pt.label && dropProgress > 0.85
                        ? interpolate(
                            dropProgress,
                            [0.85, 1],
                            [0, 1],
                            {
                              extrapolateLeft: "clamp",
                              extrapolateRight: "clamp",
                            },
                          )
                        : 0;

                    const seed = gIdx * 1000 + ptIdx * 47;

                    return (
                      <g key={ptIdx}>
                        <RoughDot
                          cx={px}
                          cy={py}
                          diameter={14}
                          seed={seed}
                          color={color}
                          scale={pointScale}
                          translateY={dropOffset}
                        />
                        {pt.label && labelAlpha > 0 && (
                          <text
                            x={px + wobble(seed + 300)}
                            y={
                              py -
                              14 +
                              dropOffset +
                              wobble(seed + 301, 2)
                            }
                            textAnchor="middle"
                            fontFamily="'Caveat', 'Comic Sans MS', cursive"
                            fontSize="16"
                            fill={color}
                            opacity={labelAlpha}
                          >
                            {pt.label}
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
