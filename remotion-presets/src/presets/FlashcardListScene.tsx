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

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

export const FlashcardListSchema = z.object({
  title: z.string(),
  items: z.array(z.string()),
});

type FlashcardListProps = z.infer<typeof FlashcardListSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#2563EB";
const CARD_W = 1600;
const CARD_H = 900;

// ─────────────────────────────────────────────────────────────────────────────
// Rough.js helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateRoughRect(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  options?: { stroke?: string; strokeWidth?: number; roughness?: number; fill?: string; fillStyle?: string },
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
        <clipPath id={`flashcard-divider-clip-${seed}`}>
          <rect x={x1} y={y1 - 10} width={clipWidth} height={20} />
        </clipPath>
      </defs>
      <g clipPath={`url(#flashcard-divider-clip-${seed})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} />
        ))}
      </g>
    </g>
  );
};

const RoughBadge: React.FC<{
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
        stroke: ACCENT,
        strokeWidth: 2,
        roughness: 1.0,
      }),
    [x, y, w, h, seed],
  );
  if (paths.length === 0 || progress <= 0) return null;
  return (
    <g style={{ opacity: progress }}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={ACCENT} strokeWidth={2} />
      ))}
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const FlashcardListScene: React.FC<FlashcardListProps> = ({
  title,
  items,
}) => {
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

  // === FLASHCARD ITEMS ===
  // Spread items evenly across the scene after the entrance animation.
  // Each item gets an equal slice of the remaining time.
  const cardBaseDelay = Math.round(2.0 * fps);
  const exitBuffer = Math.round(0.5 * fps);
  const availableFrames = durationInFrames - cardBaseDelay - exitBuffer;
  const cardStagger = items.length > 1
    ? Math.round(availableFrames / items.length)
    : Math.round(0.5 * fps);
  const cardDuration = Math.round(0.5 * fps);
  const badgeLeadFrames = Math.round(0.08 * fps); // badges appear slightly before text

  // Content layout
  const contentPadX = 100;
  const contentPadTop = 90;
  const titleBottomY = contentPadTop + 60;
  const dividerY = titleBottomY + 30;
  const cardStartY = dividerY + 50;
  const cardItemHeight = 70;
  const badgeW = 44;
  const badgeH = 36;

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
            <filter id="flashcard-paper-grain">
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
              filter: "url(#flashcard-paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Rough.js SVG overlay — border, divider, badges */}
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
              seed={31}
            />
            <RoughDivider
              x1={contentPadX}
              y1={dividerY}
              x2={CARD_W - contentPadX}
              y2={dividerY}
              progress={dividerProgress}
              seed={65}
              color="rgba(0, 0, 0, 0.12)"
            />
            {/* Rough.js number badges */}
            {items.map((_, idx) => {
              const itemStart =
                cardBaseDelay + idx * cardStagger - badgeLeadFrames;
              const badgeProgress = interpolate(
                frame,
                [itemStart, itemStart + cardDuration],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.quad),
                },
              );
              const badgeY =
                cardStartY + idx * cardItemHeight + (cardItemHeight - badgeH) / 2;
              return (
                <RoughBadge
                  key={idx}
                  x={contentPadX}
                  y={badgeY}
                  w={badgeW}
                  h={badgeH}
                  progress={badgeProgress}
                  seed={200 + idx}
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
                fontSize: 46,
                fontWeight: 700,
                color: "#1a1a1a",
                letterSpacing: "-0.02em",
                lineHeight: "56px",
                opacity: titleOpacity,
                transform: `translateY(${titleTranslateY}px)`,
                filter:
                  titleBlurVal > 0.1 ? `blur(${titleBlurVal}px)` : undefined,
                marginBottom: 80,
              }}
            >
              {title}
            </div>

            {/* Flashcard list */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
              }}
            >
              {items.map((item, idx) => {
                const itemStart = cardBaseDelay + idx * cardStagger;
                const flipProgress = interpolate(
                  frame,
                  [itemStart, itemStart + cardDuration],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.quad),
                  },
                );
                const opacity = interpolate(flipProgress, [0, 0.5], [0, 1], {
                  extrapolateRight: "clamp",
                });
                const translateY = interpolate(flipProgress, [0, 1], [30, 0]);
                const scaleY = interpolate(flipProgress, [0, 1], [0.8, 1]);
                const blur = interpolate(flipProgress, [0, 0.6], [3, 0], {
                  extrapolateRight: "clamp",
                });

                // Badge number progress (slightly ahead)
                const badgeStart = itemStart - badgeLeadFrames;
                const badgeTextProgress = interpolate(
                  frame,
                  [badgeStart, badgeStart + cardDuration],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.quad),
                  },
                );

                // Highlight: the active item is the most recently revealed one.
                // It stays highlighted until the next item appears.
                const nextItemStart = idx < items.length - 1
                  ? cardBaseDelay + (idx + 1) * cardStagger
                  : durationInFrames;
                const isActive = frame >= itemStart && frame < nextItemStart;
                const dimOpacity = opacity > 0 && !isActive ? 0.45 : 1;

                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      height: cardItemHeight,
                      opacity: opacity * dimOpacity,
                      transform: `translateY(${translateY}px) scaleY(${scaleY})`,
                      transformOrigin: "top center",
                      filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
                      transition: "opacity 0.3s ease",
                    }}
                  >
                    {/* Number badge text (overlay on rough.js rect) */}
                    <div
                      style={{
                        width: badgeW,
                        height: badgeH,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        opacity: badgeTextProgress,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: sansFont,
                          fontSize: 18,
                          fontWeight: 500,
                          color: ACCENT,
                        }}
                      >
                        {idx + 1}
                      </span>
                    </div>
                    {/* Item text */}
                    <div
                      style={{
                        fontFamily: sansFont,
                        fontSize: 24,
                        fontWeight: isActive ? 500 : 400,
                        color: isActive ? "#1a1a1a" : "#3D3428",
                        lineHeight: "34px",
                        flex: 1,
                        padding: "8px 16px",
                        backgroundColor: isActive
                          ? `rgba(37, 99, 235, ${0.06 * opacity})`
                          : `rgba(245, 240, 232, ${0.5 * opacity})`,
                        borderRadius: 4,
                        borderLeft: isActive ? `3px solid ${ACCENT}` : "3px solid transparent",
                      }}
                    >
                      {item}
                    </div>
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
