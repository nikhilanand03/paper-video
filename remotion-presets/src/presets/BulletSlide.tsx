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

const { fontFamily: serifFont } = loadFont("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const { fontFamily: sansFont } = loadInter("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

const BulletItemSchema = z.union([
  z.string(),
  z.object({ text: z.string() }),
]);

export const BulletSlideSchema = z.object({
  title: z.string(),
  items: z.array(BulletItemSchema),
});

type BulletSlideProps = z.infer<typeof BulletSlideSchema>;

function getItemText(item: string | { text: string }): string {
  return typeof item === "string" ? item : item.text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#2563EB";
const CARD_W = 1400;
const CARD_H = 880;

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

function generateRoughCircle(
  cx: number,
  cy: number,
  diameter: number,
  seed: number,
): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.circle(cx, cy, diameter, {
    roughness: 1.2,
    bowing: 1,
    seed,
    strokeWidth: 2,
    fill: "none",
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
        <clipPath id={`bullet-divider-clip-${seed}`}>
          <rect x={x1} y={y1 - 10} width={clipWidth} height={20} />
        </clipPath>
      </defs>
      <g clipPath={`url(#bullet-divider-clip-${seed})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} />
        ))}
      </g>
    </g>
  );
};

const RoughBulletDot: React.FC<{
  cx: number;
  cy: number;
  progress: number;
  seed: number;
  color: string;
}> = ({ cx, cy, progress, seed, color }) => {
  const paths = useMemo(
    () => generateRoughCircle(cx, cy, 10, seed),
    [cx, cy, seed],
  );
  if (paths.length === 0 || progress <= 0) return null;
  return (
    <g style={{ opacity: progress }}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill={color} stroke={color} strokeWidth={1.5} />
      ))}
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Bullet item (text only — dot is rendered in SVG overlay)
// ─────────────────────────────────────────────────────────────────────────────

const BulletItemText: React.FC<{
  text: string;
  progress: number;
}> = ({ text, progress }) => {
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [10, 0]);
  const blur = interpolate(progress, [0, 0.6], [3, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 24,
        opacity,
        transform: `translateY(${translateY}px)`,
        filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
      }}
    >
      {/* Spacer for rough.js dot rendered in SVG overlay */}
      <div style={{ width: 14, height: 14, flexShrink: 0, marginTop: 6 }} />
      <div
        style={{
          fontFamily: sansFont,
          fontSize: 24,
          fontWeight: 400,
          color: "#3D3428",
          lineHeight: "36px",
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const BulletSlide: React.FC<BulletSlideProps> = ({ title, items }) => {
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

  // === ACCENT LINE (top of card) ===
  const accentLineDelay = Math.round(0.8 * fps);
  const accentLineDuration = Math.round(0.8 * fps);
  const accentLineProgress = interpolate(
    frame,
    [accentLineDelay, accentLineDelay + accentLineDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  // === TITLE ===
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
  const titleBlurVal = interpolate(titleProgress, [0, 1], [6, 0]);

  // === DIVIDER under title ===
  const dividerDelay = Math.round(1.6 * fps);
  const dividerDuration = Math.round(0.8 * fps);
  const dividerProgress = interpolate(
    frame,
    [dividerDelay, dividerDelay + dividerDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // === BULLET ITEMS ===
  const bulletBaseDelay = Math.round(2.0 * fps);
  const bulletStagger = Math.round(0.18 * fps);
  const bulletDuration = Math.round(0.5 * fps);

  // Content padding inside card
  const contentPadX = 100;
  const contentPadTop = 100;
  const titleBottomY = contentPadTop + 60; // approx title height
  const dividerY = titleBottomY + 30;
  const bulletStartY = dividerY + 40;
  const bulletLineHeight = 56; // gap between bullet items

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
            <filter id="bullet-paper-grain">
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
              filter: "url(#bullet-paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Rough.js SVG overlay — border, divider, bullet dots */}
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
              seed={21}
            />
            <RoughDivider
              x1={contentPadX}
              y1={dividerY}
              x2={CARD_W - contentPadX}
              y2={dividerY}
              progress={dividerProgress}
              seed={55}
              color="rgba(0, 0, 0, 0.12)"
            />
            {/* Rough.js bullet dots */}
            {items.map((_, idx) => {
              const itemStart = bulletBaseDelay + idx * bulletStagger;
              const dotProgress = interpolate(
                frame,
                [itemStart, itemStart + bulletDuration],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.quad),
                },
              );
              const dotY = bulletStartY + idx * bulletLineHeight + 12;
              return (
                <RoughBulletDot
                  key={idx}
                  cx={contentPadX + 7}
                  cy={dotY}
                  progress={dotProgress}
                  seed={100 + idx}
                  color={ACCENT}
                />
              );
            })}
          </svg>

          {/* Accent line — top gradient strip */}
          <div
            style={{
              position: "absolute",
              top: 24,
              left: 80,
              right: 80,
              height: 2,
              background: `linear-gradient(90deg, ${ACCENT}, #7C3AED)`,
              transformOrigin: "left center",
              transform: `scaleX(${accentLineProgress})`,
              opacity: accentLineProgress,
              borderRadius: 1,
            }}
          />

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
            {/* Title */}
            <div
              style={{
                fontFamily: serifFont,
                fontSize: 48,
                fontWeight: 700,
                color: "#1a1a1a",
                letterSpacing: "-0.02em",
                lineHeight: "58px",
                opacity: titleOpacity,
                transform: `translateY(${titleTranslateY}px)`,
                filter:
                  titleBlurVal > 0.1 ? `blur(${titleBlurVal}px)` : undefined,
                marginBottom: 70,
              }}
            >
              {title}
            </div>

            {/* Bullet list */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {items.map((item, idx) => {
                const itemStart = bulletBaseDelay + idx * bulletStagger;
                const progress = interpolate(
                  frame,
                  [itemStart, itemStart + bulletDuration],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.quad),
                  },
                );
                return (
                  <BulletItemText
                    key={idx}
                    text={getItemText(item)}
                    progress={progress}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
