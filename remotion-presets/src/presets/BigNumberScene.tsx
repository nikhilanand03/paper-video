import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  AbsoluteFill,
} from "remotion";
import rough from "roughjs";
import { loadFont } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: serifFont } = loadFont("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const { fontFamily: sansFont } = loadInter("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BigNumberProps = {
  label: string;
  value: string;
  unit?: string;
  description?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Seeded helpers — fully deterministic, zero random()
// ─────────────────────────────────────────────────────────────────────────────

function seeded(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453;
  return x - Math.floor(x);
}

function jitter(seed: number, amp: number): number {
  return (seeded(seed) - 0.5) * 2 * amp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hand-crafted SVG paths for digits 0–9 and common punctuation
// ─────────────────────────────────────────────────────────────────────────────

type GlyphDef = {
  strokes: string[];
  width: number;
};

const GLYPH_HEIGHT = 80;

const GLYPHS: Record<string, GlyphDef> = {
  "0": {
    strokes: [
      "M 30 8 C 52 8 58 20 58 40 C 58 60 52 72 30 72 C 8 72 2 60 2 40 C 2 20 8 8 30 8 Z",
    ],
    width: 60,
  },
  "1": {
    strokes: [
      "M 18 20 C 22 16 26 12 32 8",
      "M 32 8 L 32 72",
      "M 16 72 L 48 72",
    ],
    width: 50,
  },
  "2": {
    strokes: [
      "M 6 28 C 6 8 54 4 54 28 C 54 46 10 58 6 72",
      "M 6 72 L 54 72",
    ],
    width: 60,
  },
  "3": {
    strokes: [
      "M 6 12 C 28 4 58 10 54 32 C 52 44 34 42 30 42",
      "M 30 42 C 48 42 58 50 54 62 C 50 76 28 80 6 72",
    ],
    width: 60,
  },
  "4": {
    strokes: [
      "M 40 72 L 40 8 L 4 52",
      "M 4 52 L 56 52",
    ],
    width: 60,
  },
  "5": {
    strokes: [
      "M 50 8 L 8 8",
      "M 8 8 L 8 40 C 8 40 20 34 36 36 C 56 38 58 56 50 66 C 42 76 22 78 4 68",
    ],
    width: 60,
  },
  "6": {
    strokes: [
      "M 50 12 C 32 0 4 10 4 44 C 4 62 14 76 32 76 C 50 76 58 62 56 48 C 54 34 42 28 28 30 C 14 32 4 44 4 44",
    ],
    width: 60,
  },
  "7": {
    strokes: [
      "M 4 8 L 56 8",
      "M 56 8 L 24 72",
      "M 14 46 L 44 46",
    ],
    width: 60,
  },
  "8": {
    strokes: [
      "M 30 40 C 10 40 4 26 4 18 C 4 8 14 4 28 4 C 44 4 56 8 56 18 C 56 28 48 38 30 40",
      "M 30 40 C 8 42 2 56 4 64 C 6 74 18 80 30 80 C 44 80 58 74 58 64 C 58 52 48 42 30 40",
    ],
    width: 62,
  },
  "9": {
    strokes: [
      "M 30 4 C 50 4 58 16 58 30 C 58 46 48 56 32 56 C 16 56 4 46 4 30 C 4 14 16 4 30 4 M 30 4 C 52 4 58 16 58 30 L 58 68",
    ],
    width: 62,
  },
  ".": {
    strokes: ["M 12 68 C 12 64 18 64 18 68 C 18 72 12 72 12 68 Z"],
    width: 28,
  },
  ",": {
    strokes: ["M 12 64 C 12 60 18 60 18 64 C 18 70 12 76 8 78"],
    width: 28,
  },
  "%": {
    strokes: [
      "M 4 68 L 56 12",
      "M 14 12 C 10 8 6 10 4 14 C 2 18 4 24 8 26 C 14 28 20 24 20 18 C 20 12 14 8 14 12",
      "M 46 68 C 42 64 38 66 36 70 C 34 74 36 80 42 80 C 48 80 54 76 52 70 C 50 64 44 62 46 68",
    ],
    width: 64,
  },
  K: {
    strokes: [
      "M 8 8 L 8 72",
      "M 8 40 L 52 8",
      "M 8 40 L 52 72",
    ],
    width: 60,
  },
  M: {
    strokes: ["M 4 72 L 4 8 L 30 48 L 56 8 L 56 72"],
    width: 64,
  },
  B: {
    strokes: [
      "M 8 8 L 8 72",
      "M 8 8 C 8 8 44 8 48 20 C 52 32 36 40 8 40",
      "M 8 40 C 8 40 50 40 54 54 C 58 68 44 72 8 72",
    ],
    width: 60,
  },
  "+": {
    strokes: [
      "M 28 12 L 28 68",
      "M 4 40 L 52 40",
    ],
    width: 56,
  },
  x: {
    strokes: [
      "M 4 56 L 48 16",
      "M 48 56 L 4 16",
    ],
    width: 52,
  },
  " ": { strokes: [], width: 24 },
};

const UNKNOWN_GLYPH: GlyphDef = {
  strokes: ["M 4 8 L 4 72 L 56 72 L 56 8 Z"],
  width: 60,
};

// ─────────────────────────────────────────────────────────────────────────────
// Path length estimation
// ─────────────────────────────────────────────────────────────────────────────

function estimatePathLength(d: string): number {
  let length = 0;
  let cx = 0,
    cy = 0,
    startX = 0,
    startY = 0;

  const cmds = d.match(/[MLCQZ][^MLCQZ]*/gi) ?? [];

  for (const cmd of cmds) {
    const type = cmd[0].toUpperCase();
    const nums = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n));

    if (type === "M") {
      cx = nums[0] ?? cx;
      cy = nums[1] ?? cy;
      startX = cx;
      startY = cy;
      for (let i = 2; i < nums.length; i += 2) {
        const nx = nums[i],
          ny = nums[i + 1];
        length += Math.hypot(nx - cx, ny - cy);
        cx = nx;
        cy = ny;
      }
    } else if (type === "L") {
      for (let i = 0; i < nums.length; i += 2) {
        const nx = nums[i],
          ny = nums[i + 1];
        length += Math.hypot(nx - cx, ny - cy);
        cx = nx;
        cy = ny;
      }
    } else if (type === "C") {
      for (let seg = 0; seg < nums.length; seg += 6) {
        const [x1, y1, x2, y2, x3, y3] = nums.slice(seg, seg + 6);
        const STEPS = 10;
        let px = cx,
          py = cy;
        for (let s = 1; s <= STEPS; s++) {
          const t = s / STEPS;
          const mt = 1 - t;
          const nx =
            mt * mt * mt * cx +
            3 * mt * mt * t * x1 +
            3 * mt * t * t * x2 +
            t * t * t * x3;
          const ny =
            mt * mt * mt * cy +
            3 * mt * mt * t * y1 +
            3 * mt * t * t * y2 +
            t * t * t * y3;
          length += Math.hypot(nx - px, ny - py);
          px = nx;
          py = ny;
        }
        cx = x3;
        cy = y3;
      }
    } else if (type === "Q") {
      for (let seg = 0; seg < nums.length; seg += 4) {
        const [x1, y1, x2, y2] = nums.slice(seg, seg + 4);
        const STEPS = 10;
        let px = cx,
          py = cy;
        for (let s = 1; s <= STEPS; s++) {
          const t = s / STEPS;
          const mt = 1 - t;
          const nx = mt * mt * cx + 2 * mt * t * x1 + t * t * x2;
          const ny = mt * mt * cy + 2 * mt * t * y1 + t * t * y2;
          length += Math.hypot(nx - px, ny - py);
          px = nx;
          py = ny;
        }
        cx = x2;
        cy = y2;
      }
    } else if (type === "Z") {
      length += Math.hypot(startX - cx, startY - cy);
      cx = startX;
      cy = startY;
    }
  }

  return Math.max(length, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Build layout
// ─────────────────────────────────────────────────────────────────────────────

type PlacedStroke = {
  path: string;
  length: number;
  translateX: number;
  strokeIndex: number;
};

function buildLayout(value: string): PlacedStroke[] {
  const chars = value.split("");
  let x = 0;
  let strokeIndex = 0;
  const placed: PlacedStroke[] = [];

  for (const ch of chars) {
    const glyph = GLYPHS[ch] ?? UNKNOWN_GLYPH;
    for (const stroke of glyph.strokes) {
      placed.push({
        path: stroke,
        length: estimatePathLength(stroke),
        translateX: x,
        strokeIndex: strokeIndex++,
      });
    }
    x += glyph.width + 4;
  }

  return placed;
}

function totalGlyphWidth(value: string): number {
  return value.split("").reduce((acc, ch) => {
    const g = GLYPHS[ch] ?? UNKNOWN_GLYPH;
    return acc + g.width + 4;
  }, -4);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pencil filter — gives strokes a graphite-on-paper feel
// ─────────────────────────────────────────────────────────────────────────────

const PencilFilter: React.FC<{ id: string }> = ({ id }) => (
  <defs>
    {/* Pencil displacement — rough graphite edge */}
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence
        type="turbulence"
        baseFrequency="1.2 0.8"
        numOctaves="5"
        seed="5"
        result="noise"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="noise"
        scale="1.8"
        xChannelSelector="R"
        yChannelSelector="G"
        result="displaced"
      />
      {/* Roughen edges with slight erosion */}
      <feMorphology
        in="displaced"
        operator="erode"
        radius="0.3"
        result="eroded"
      />
      <feComposite in="eroded" in2="SourceGraphic" operator="atop" />
    </filter>

    {/* Pencil grain texture — overlaid on strokes */}
    <filter id={`${id}-grain`} x="0%" y="0%" width="100%" height="100%">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="2.5 1.8"
        numOctaves="3"
        seed="8"
        result="pencilNoise"
      />
      <feColorMatrix
        in="pencilNoise"
        type="saturate"
        values="0"
        result="bwNoise"
      />
      <feBlend in="SourceGraphic" in2="bwNoise" mode="multiply" />
    </filter>
  </defs>
);

// ─────────────────────────────────────────────────────────────────────────────
// HandwrittenNumber — pencil-drawn SVG digits
// ─────────────────────────────────────────────────────────────────────────────

type HandwrittenNumberProps = {
  value: string;
  progress: number;
  fillOpacity: number;
  color: string;
  scale?: number;
};

export const HandwrittenNumber: React.FC<HandwrittenNumberProps> = ({
  value,
  progress,
  fillOpacity,
  color,
  scale = 1,
}) => {
  const frame = useCurrentFrame();

  const strokes = useMemo(() => buildLayout(value), [value]);
  const totalWidth = totalGlyphWidth(value) * scale;
  const svgH = GLYPH_HEIGHT * scale;

  const totalLength = useMemo(
    () => strokes.reduce((s, st) => s + st.length, 0),
    [strokes],
  );

  const drawnLength = progress * totalLength;

  return (
    <svg
      width={totalWidth}
      height={svgH + 16}
      viewBox={`0 0 ${totalWidth / scale} ${GLYPH_HEIGHT + 16 / scale}`}
      style={{ overflow: "visible" }}
    >
      <PencilFilter id="pencil" />

      {strokes.map((st, i) => {
        const lengthBefore = strokes
          .slice(0, i)
          .reduce((a, s) => a + s.length, 0);
        const strokeProgress = Math.min(
          1,
          Math.max(0, (drawnLength - lengthBefore) / st.length),
        );

        if (strokeProgress <= 0) return null;

        const drawn = st.length * strokeProgress;
        const dashArray = `${drawn} ${st.length + 10}`;

        // Pressure variation — thicker in the middle of each stroke
        const pressure = 1 + 0.3 * Math.sin(strokeProgress * Math.PI);

        // Organic hand jitter while actively drawing
        const isDrawing = strokeProgress > 0 && strokeProgress < 1;
        const jx = isDrawing ? jitter(frame * 7 + i * 13, 0.8) : 0;
        const jy = isDrawing ? jitter(frame * 11 + i * 17, 0.6) : 0;

        const tx = st.translateX + jx;
        const ty = 8 + jy;

        return (
          <g key={i} transform={`translate(${tx}, ${ty})`}>
            {/* Main pencil stroke — with displacement filter */}
            <path
              d={st.path}
              fill="none"
              stroke={color}
              strokeWidth={6 * pressure}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dashArray}
              strokeDashoffset={0}
              // filter="url(#pencil)"
              opacity={0.92}
            />
            {/* Lighter pressure ghost — pencil graphite scatter */}
            <path
              d={st.path}
              fill="none"
              stroke={color}
              strokeWidth={3 * pressure}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dashArray}
              strokeDashoffset={0}
              // filter="url(#pencil-grain)"
              opacity={0.35}
              transform="translate(1, 1)"
            />
            {/* Fine edge line — sharp pencil tip detail */}
            <path
              d={st.path}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dashArray}
              strokeDashoffset={0}
              opacity={0.5}
              transform="translate(-0.5, -0.5)"
            />
            {/* Graphite fill settling after stroke completes */}
            {strokeProgress >= 1 && (
              <path
                d={st.path}
                fill={color}
                stroke="none"
                opacity={fillOpacity * 0.08}
                filter="url(#pencil-grain)"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
};

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
        <clipPath id={`bignum-divider-clip-${seed}`}>
          <rect x={x1} y={y1 - 10} width={clipWidth} height={20} />
        </clipPath>
      </defs>
      <g clipPath={`url(#bignum-divider-clip-${seed})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} />
        ))}
      </g>
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CARD_W = 1600;
const CARD_H = 900;
const NUMBER_SCALE = 3.2;

// ─────────────────────────────────────────────────────────────────────────────
// BigNumberScene — main composition component
// ─────────────────────────────────────────────────────────────────────────────

export const BigNumberScene: React.FC<BigNumberProps> = ({
  label,
  value,
  unit,
  description,
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
    radial-gradient(circle at 14% 78%, rgba(139,105,60,0.10) 0%, rgba(139,105,60,0.06) 6%, transparent 13%),
    radial-gradient(circle at 86% 20%, rgba(139,105,60,0.08) 0%, rgba(139,105,60,0.04) 7%, transparent 12%)
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
  const accentDelay = Math.round(0.8 * fps);
  const accentDuration = Math.round(0.8 * fps);
  const accentProgress = interpolate(
    frame,
    [accentDelay, accentDelay + accentDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  // === DIVIDER under number ===
  const dividerDelay = Math.round(3.6 * fps);
  const dividerDuration = Math.round(0.8 * fps);
  const dividerProgress = interpolate(
    frame,
    [dividerDelay, dividerDelay + dividerDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // === LABEL ===
  const labelDelay = Math.round(1.0 * fps);
  const labelDuration = Math.round(0.5 * fps);
  const labelProgress = interpolate(
    frame,
    [labelDelay, labelDelay + labelDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );
  const labelOpacity = interpolate(labelProgress, [0, 1], [0, 1]);
  const labelBlur = interpolate(labelProgress, [0, 1], [4, 0]);

  // === NUMBER DRAWING ===
  const NUM_START = Math.round(1.4 * fps);
  const NUM_END = Math.round(3.4 * fps);
  const numProgress = interpolate(frame, [NUM_START, NUM_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const fillOpacity = interpolate(frame, [NUM_END, NUM_END + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Number entrance lift
  const numberLift = spring({
    frame: frame - NUM_START,
    fps,
    config: { damping: 200 },
    durationInFrames: 20,
  });
  const numberY = interpolate(numberLift, [0, 1], [16, 0]);

  // === UNIT ===
  const UNIT_START = Math.round(3.4 * fps);
  const UNIT_END = Math.round(3.9 * fps);
  const unitAlpha = interpolate(frame, [UNIT_START, UNIT_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const unitY = interpolate(frame, [UNIT_START, UNIT_END], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const unitBlur = interpolate(frame, [UNIT_START, UNIT_END], [4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === DESCRIPTION ===
  const DESC_START = Math.round(4.0 * fps);
  const DESC_END = Math.round(4.8 * fps);
  const descAlpha = interpolate(frame, [DESC_START, DESC_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const descY = interpolate(frame, [DESC_START, DESC_END], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // === SVG dimensions for number ===
  const numSvgW = (totalGlyphWidth(value) + 8) * NUMBER_SCALE;
  const numSvgH = (GLYPH_HEIGHT + 16) * NUMBER_SCALE;

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
            <filter id="bignum-paper-grain">
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
              filter: "url(#bignum-paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Rough.js SVG overlay — border + divider */}
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
              seed={47}
            />
            <RoughDivider
              x1={CARD_W / 2 - 200}
              y1={620}
              x2={CARD_W / 2 + 200}
              y2={620}
              progress={dividerProgress}
              seed={63}
              color="rgba(0, 0, 0, 0.10)"
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
              background: "linear-gradient(90deg, #7C3AED, #2563EB)",
              transformOrigin: "left center",
              transform: `scaleX(${accentProgress})`,
              opacity: accentProgress,
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
            {/* Label */}
            <div
              style={{
                opacity: labelOpacity,
                filter: labelBlur > 0.1 ? `blur(${labelBlur}px)` : undefined,
                fontFamily: serifFont,
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#8B7D6B",
                marginBottom: 36,
              }}
            >
              {label}
            </div>

            {/* Number + Unit row */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 20,
                transform: `translateY(${numberY}px)`,
                position: "relative",
                zIndex: 1,
                marginBottom: 24,
              }}
            >
              {/* Hand-written pencil number */}
              <div
                style={{
                  lineHeight: 0,
                  width: numSvgW,
                  height: numSvgH,
                }}
              >
                <HandwrittenNumber
                  value={value}
                  progress={numProgress}
                  fillOpacity={fillOpacity}
                  color="#5A4F3A"
                  scale={NUMBER_SCALE}
                />
              </div>

              {/* Unit */}
              {unit && (
                <div
                  style={{
                    opacity: unitAlpha * 0.7,
                    transform: `translateY(${unitY}px)`,
                    filter:
                      unitBlur > 0.1 ? `blur(${unitBlur}px)` : undefined,
                    fontFamily: serifFont,
                    fontSize: 48,
                    fontWeight: 700,
                    color: "#5A4F3A",
                    paddingBottom: 18,
                    letterSpacing: "-0.02em",
                    fontStyle: "italic",
                  }}
                >
                  {unit}
                </div>
              )}
            </div>

            {/* Description */}
            {description && (
              <div
                style={{
                  opacity: descAlpha,
                  transform: `translateY(${descY}px)`,
                  fontFamily: sansFont,
                  fontSize: 22,
                  fontWeight: 400,
                  color: "#6B6052",
                  marginTop: 32,
                  maxWidth: 600,
                  textAlign: "center",
                  lineHeight: 1.7,
                  letterSpacing: "0.01em",
                }}
              >
                {description}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
