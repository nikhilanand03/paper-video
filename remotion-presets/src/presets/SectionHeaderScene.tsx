import { z } from "zod";
import { useMemo, useCallback } from "react";
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
  weights: ["400", "600"],
  subsets: ["latin"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

export const SectionHeaderSchema = z.object({
  sectionNumber: z.number(),
  heading: z.string(),
  tagline: z.string().optional(),
});

type SectionHeaderProps = z.infer<typeof SectionHeaderSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

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
    roughness: 1.2,
    bowing: 1.5,
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

const RoughDrawLine: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  progress: number;
  seed: number;
  color: string;
  clipId: string;
}> = ({ x1, y1, x2, y2, progress, seed, color, clipId }) => {
  const paths = useMemo(
    () => generateRoughLine(x1, y1, x2, y2, seed),
    [x1, y1, x2, y2, seed],
  );
  if (paths.length === 0 || progress <= 0) return null;
  const clipWidth = (x2 - x1) * progress;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x1} y={y1 - 10} width={clipWidth} height={20} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} />
        ))}
      </g>
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const SectionHeaderScene: React.FC<SectionHeaderProps> = ({
  sectionNumber,
  heading,
  tagline,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // === ENTRANCE (0-2s): Scale + blur (like TitleCard) ===
  const entranceSpring = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 80 },
    durationInFrames: 2 * fps,
  });
  const entranceScale = interpolate(entranceSpring, [0, 1], [0.85, 1]);
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

  // === KEN BURNS: Subtle zoom + drift ===
  const kenBurnsScale = interpolate(
    frame,
    [0, durationInFrames],
    [1.0, 1.04],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const driftX = interpolate(frame, [0, durationInFrames], [0, 8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftY = interpolate(frame, [0, durationInFrames], [0, -4], {
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

  // === DECORATIVE BACKGROUND NUMBER (very large, very faint) ===
  const numberDelay = Math.round(0.8 * fps);
  const numberDuration = Math.round(1.2 * fps);
  const numberOpacity = interpolate(
    frame,
    [numberDelay, numberDelay + numberDuration],
    [0, 0.04],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );
  const numberScale = interpolate(
    frame,
    [numberDelay, numberDelay + numberDuration],
    [0.9, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  // === "PART X" LABEL ===
  const partLabelDelay = Math.round(1.2 * fps);
  const partLabelDuration = Math.round(0.5 * fps);
  const partLabelOpacity = interpolate(
    frame,
    [partLabelDelay, partLabelDelay + partLabelDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );
  const partLabelTranslateY = interpolate(
    frame,
    [partLabelDelay, partLabelDelay + partLabelDuration],
    [10, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  // === ROUGH.JS UNDERLINE UNDER "PART X" (draws itself) ===
  const partUnderlineDelay = Math.round(1.4 * fps);
  const partUnderlineDuration = Math.round(0.6 * fps);
  const partUnderlineProgress = interpolate(
    frame,
    [partUnderlineDelay, partUnderlineDelay + partUnderlineDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  // === ROUGH.JS DIVIDER between "PART X" area and heading ===
  const dividerDelay = Math.round(1.6 * fps);
  const dividerDuration = Math.round(0.8 * fps);
  const dividerProgress = interpolate(
    frame,
    [dividerDelay, dividerDelay + dividerDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  // === HEADING — line-by-line reveal (like TitleCard) ===
  const splitIntoLines = useCallback((text: string): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if (current.length + word.length + 1 > 45 && current.length > 0) {
        lines.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }, []);

  const headingLines = splitIntoLines(heading);
  const headingStartDelay = Math.round(2.0 * fps);
  const lineStagger = Math.round(0.2 * fps);

  // === TAGLINE ===
  const headingEndFrame =
    headingStartDelay + headingLines.length * lineStagger + Math.round(0.6 * fps);
  const taglineDelay = headingEndFrame + Math.round(0.2 * fps);
  const taglineDuration = Math.round(0.5 * fps);
  const taglineOpacity = interpolate(
    frame,
    [taglineDelay, taglineDelay + taglineDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );
  const taglineTranslateY = interpolate(
    frame,
    [taglineDelay, taglineDelay + taglineDuration],
    [10, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  // Roman numeral helper for section numbers
  const toRoman = (num: number): string => {
    const romanNumerals: Array<[number, string]> = [
      [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
    ];
    let result = "";
    let remaining = num;
    for (const [value, numeral] of romanNumerals) {
      while (remaining >= value) {
        result += numeral;
        remaining -= value;
      }
    }
    return result;
  };

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
            <filter id="section-paper-grain">
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
              filter: "url(#section-paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Decorative background number — very large, very faint */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              right: 80,
              transform: `translateY(-50%) scale(${numberScale})`,
              opacity: numberOpacity,
              fontFamily: serifFont,
              fontSize: 320,
              fontWeight: 700,
              color: "#1a1a1a",
              lineHeight: 1,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {toRoman(sectionNumber)}
          </div>

          {/* Rough.js SVG overlay (border + dividers) */}
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
              seed={17}
            />
            {/* Rough underline beneath "PART X" label */}
            <RoughDrawLine
              x1={100}
              y1={305}
              x2={280}
              y2={305}
              progress={partUnderlineProgress}
              seed={51}
              color="rgba(0, 0, 0, 0.15)"
              clipId="section-part-underline-clip"
            />
            {/* Rough divider between PART label area and heading */}
            <RoughDrawLine
              x1={100}
              y1={340}
              x2={CARD_W - 100}
              y2={340}
              progress={dividerProgress}
              seed={63}
              color="rgba(0, 0, 0, 0.08)"
              clipId="section-divider-clip"
            />
          </svg>

          {/* Text content */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: "100px 100px",
              display: "flex",
              flexDirection: "column",
              zIndex: 1,
            }}
          >
            {/* "PART X" label */}
            <div
              style={{
                fontFamily: sansFont,
                fontSize: 16,
                fontWeight: 600,
                color: "#555",
                textTransform: "uppercase" as const,
                letterSpacing: "0.22em",
                marginBottom: 40,
                opacity: partLabelOpacity,
                transform: `translateY(${partLabelTranslateY}px)`,
              }}
            >
              PART {toRoman(sectionNumber)}
            </div>

            {/* Spacing for the divider area */}
            <div style={{ height: 40 }} />

            {/* Heading — line by line reveal (TitleCard style) */}
            <div style={{ marginBottom: 28 }}>
              {headingLines.map((line, idx) => {
                const lineStart = headingStartDelay + idx * lineStagger;
                const lineOpacity = interpolate(
                  frame,
                  [lineStart, lineStart + 0.6 * fps],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );
                const lineTranslateY = interpolate(
                  frame,
                  [lineStart, lineStart + 0.6 * fps],
                  [10, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.quad),
                  },
                );
                return (
                  <div
                    key={idx}
                    style={{
                      fontFamily: serifFont,
                      fontSize: 60,
                      fontWeight: 700,
                      lineHeight: "72px",
                      color: "#1a1a1a",
                      letterSpacing: "-0.02em",
                      opacity: lineOpacity,
                      transform: `translateY(${lineTranslateY}px)`,
                    }}
                  >
                    {line}
                  </div>
                );
              })}
            </div>

            {/* Tagline — italic serif (like TitleCard subtitle) */}
            {tagline && (
              <div
                style={{
                  fontFamily: serifFont,
                  fontSize: 32,
                  fontWeight: 500,
                  fontStyle: "italic",
                  color: "#666",
                  lineHeight: "42px",
                  maxWidth: 900,
                  opacity: taglineOpacity,
                  transform: `translateY(${taglineTranslateY}px)`,
                }}
              >
                {tagline}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
