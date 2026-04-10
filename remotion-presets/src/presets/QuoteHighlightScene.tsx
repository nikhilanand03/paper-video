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

const { fontFamily: serifFont } = loadFont("italic", {
  weights: ["500"],
  subsets: ["latin"],
});

const { fontFamily: sansFont } = loadInter("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

export const QuoteHighlightSchema = z.object({
  quote: z.string(),
  highlightPhrase: z.string().optional(),
  attribution: z.string().optional(),
});

type QuoteHighlightProps = z.infer<typeof QuoteHighlightSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRIMARY = "#2563EB";
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

function generateRoughQuoteMark(seed: number): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  // Draw a large decorative open-quote using two rough arcs/curves
  const paths: string[] = [];
  // Left quote circle
  const c1 = rc.arc(40, 60, 50, 50, Math.PI, Math.PI * 2.5, false, {
    roughness: 1.2,
    bowing: 1.5,
    seed,
    strokeWidth: 3,
  });
  c1.querySelectorAll("path").forEach((p) => {
    const d = p.getAttribute("d");
    if (d) paths.push(d);
  });
  // Right quote circle
  const c2 = rc.arc(80, 60, 50, 50, Math.PI, Math.PI * 2.5, false, {
    roughness: 1.2,
    bowing: 1.5,
    seed: seed + 1,
    strokeWidth: 3,
  });
  c2.querySelectorAll("path").forEach((p) => {
    const d = p.getAttribute("d");
    if (d) paths.push(d);
  });
  return paths;
}

function generateRoughUnderline(
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
    roughness: 1.5,
    bowing: 2,
    seed,
    strokeWidth: 2.5,
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

const RoughAccentLine: React.FC<{
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
        <clipPath id={`quote-accent-clip-${seed}`}>
          <rect x={x1} y={y1 - 10} width={clipWidth} height={20} />
        </clipPath>
      </defs>
      <g clipPath={`url(#quote-accent-clip-${seed})`}>
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

export const QuoteHighlightScene: React.FC<QuoteHighlightProps> = ({
  quote,
  highlightPhrase,
  attribution,
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

  // === KEN BURNS: Subtle zoom + drift ===
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

  // === DECORATIVE QUOTE MARK ===
  const quoteMarkDelay = Math.round(0.6 * fps);
  const quoteMarkDuration = Math.round(0.8 * fps);
  const quoteMarkPaths = useMemo(() => generateRoughQuoteMark(77), []);

  const quoteMarkSpring = spring({
    frame,
    fps,
    delay: quoteMarkDelay,
    config: { damping: 120, stiffness: 60 },
  });
  const quoteMarkScale = interpolate(quoteMarkSpring, [0, 1], [0.3, 1]);
  const quoteMarkOpacity = interpolate(quoteMarkSpring, [0, 1], [0, 0.15]);
  // Stamp-landing rotation
  const quoteMarkRotation = interpolate(
    frame,
    [quoteMarkDelay, quoteMarkDelay + quoteMarkDuration],
    [-15, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.back(1.5)),
    },
  );

  // === WORD-BY-WORD QUOTE TEXT ===
  const words = quote.split(/\s+/);
  const wordStartDelay = Math.round(0.85 * fps);
  const wordStagger = Math.round(0.05 * fps); // frames between each word
  const wordFadeDuration = Math.round(0.2 * fps);

  // Find which words are part of the highlight phrase
  const highlightWordIndices: Set<number> = useMemo(() => {
    const indices = new Set<number>();
    if (!highlightPhrase) return indices;
    const hWords = highlightPhrase.split(/\s+/);
    const quoteWords = quote.split(/\s+/);
    for (let i = 0; i <= quoteWords.length - hWords.length; i++) {
      let match = true;
      for (let j = 0; j < hWords.length; j++) {
        // Compare stripped of punctuation
        const qClean = quoteWords[i + j].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        const hClean = hWords[j].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        if (qClean !== hClean) {
          match = false;
          break;
        }
      }
      if (match) {
        for (let j = 0; j < hWords.length; j++) {
          indices.add(i + j);
        }
        break;
      }
    }
    return indices;
  }, [quote, highlightPhrase]);

  // Underline animation — starts after the last highlighted word appears
  const lastHighlightIndex = highlightWordIndices.size > 0
    ? Math.max(...Array.from(highlightWordIndices))
    : 0;
  const underlineStartFrame =
    wordStartDelay + lastHighlightIndex * wordStagger + wordFadeDuration + Math.round(0.2 * fps);
  const underlineDuration = Math.round(0.6 * fps);
  const underlineProgress = interpolate(
    frame,
    [underlineStartFrame, underlineStartFrame + underlineDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  // Rough underline paths (drawn in SVG space; we position it via the overlay SVG)
  const underlinePaths = useMemo(
    () => generateRoughUnderline(0, 5, 400, 5, 99),
    [],
  );

  // === ATTRIBUTION ===
  const allWordsEndFrame = wordStartDelay + words.length * wordStagger + wordFadeDuration;
  const attributionDelay = allWordsEndFrame + Math.round(0.3 * fps);
  const attributionDuration = Math.round(0.5 * fps);
  const attributionOpacity = interpolate(
    frame,
    [attributionDelay, attributionDelay + attributionDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );
  const attributionTranslateY = interpolate(
    frame,
    [attributionDelay, attributionDelay + attributionDuration],
    [12, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

  // === BOTTOM ACCENT LINE ===
  const bottomLineDelay = Math.round(1.0 * fps);
  const bottomLineDuration = Math.round(0.5 * fps);
  const bottomLineProgress = interpolate(
    frame,
    [bottomLineDelay, bottomLineDelay + bottomLineDuration],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );

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
            <filter id="quote-paper-grain">
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
              filter: "url(#quote-paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Rough.js SVG overlay (border + accent divider) */}
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
              seed={21}
            />
            <RoughAccentLine
              x1={CARD_W / 2 - 140}
              y1={CARD_H - 60}
              x2={CARD_W / 2 + 140}
              y2={CARD_H - 60}
              progress={bottomLineProgress}
              seed={55}
              color="rgba(0, 0, 0, 0.12)"
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
              background: `linear-gradient(90deg, ${PRIMARY}, #7C3AED)`,
              transformOrigin: "left center",
              transform: `scaleX(${topLineProgress})`,
              opacity: topLineProgress,
              borderRadius: 1,
            }}
          />

          {/* Decorative rough.js quote mark */}
          <div
            style={{
              position: "absolute",
              top: 60,
              left: 80,
              width: 120,
              height: 100,
              opacity: quoteMarkOpacity,
              transform: `scale(${quoteMarkScale}) rotate(${quoteMarkRotation}deg)`,
              transformOrigin: "center center",
              zIndex: 0,
            }}
          >
            <svg width={120} height={100} viewBox="0 0 120 100">
              {quoteMarkPaths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="#1a1a1a"
                  strokeWidth={3}
                />
              ))}
            </svg>
          </div>

          {/* Large faded decorative quotation mark (typographic) */}
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 60,
              fontSize: 280,
              fontFamily: serifFont,
              fontWeight: 500,
              color: PRIMARY,
              opacity: quoteMarkOpacity * 0.6,
              transform: `scale(${quoteMarkScale}) rotate(${quoteMarkRotation}deg)`,
              transformOrigin: "center center",
              lineHeight: 1,
              userSelect: "none",
              zIndex: 0,
            }}
          >
            {"\u201C"}
          </div>

          {/* Content */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px 120px",
              zIndex: 1,
            }}
          >
            {/* Quote text — word by word */}
            <div
              style={{
                fontFamily: serifFont,
                fontSize: 32,
                fontWeight: 500,
                fontStyle: "italic",
                color: "#1a1a1a",
                lineHeight: "52px",
                textAlign: "center",
                maxWidth: 1100,
                position: "relative",
              }}
            >
              {words.map((word, i) => {
                const wordDelay = wordStartDelay + i * wordStagger;
                const wordOpacity = interpolate(
                  frame,
                  [wordDelay, wordDelay + wordFadeDuration],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );

                const isHighlighted = highlightWordIndices.has(i);

                return (
                  <span
                    key={i}
                    style={{
                      display: "inline",
                      opacity: wordOpacity,
                      color: isHighlighted ? PRIMARY : "#1a1a1a",
                      backgroundColor: isHighlighted
                        ? `rgba(37, 99, 235, ${0.08 * wordOpacity})`
                        : undefined,
                      padding: isHighlighted ? "2px 4px" : undefined,
                      borderRadius: isHighlighted ? 3 : undefined,
                    }}
                  >
                    {word}{" "}
                  </span>
                );
              })}

              {/* Rough.js underline for highlighted phrase */}
              {highlightPhrase && highlightWordIndices.size > 0 && underlineProgress > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -4,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 400,
                    height: 12,
                    overflow: "hidden",
                  }}
                >
                  <svg
                    width={400}
                    height={12}
                    style={{ overflow: "visible" }}
                  >
                    <defs>
                      <clipPath id="quote-underline-clip">
                        <rect
                          x={0}
                          y={0}
                          width={400 * underlineProgress}
                          height={12}
                        />
                      </clipPath>
                    </defs>
                    <g clipPath="url(#quote-underline-clip)">
                      {underlinePaths.map((d, i) => (
                        <path
                          key={i}
                          d={d}
                          fill="none"
                          stroke={PRIMARY}
                          strokeWidth={2.5}
                          opacity={0.6}
                        />
                      ))}
                    </g>
                  </svg>
                </div>
              )}
            </div>

            {/* Attribution */}
            {attribution && (
              <div
                style={{
                  fontFamily: sansFont,
                  fontSize: 20,
                  color: "#888",
                  marginTop: 32,
                  opacity: attributionOpacity,
                  transform: `translateY(${attributionTranslateY}px)`,
                  letterSpacing: "0.01em",
                }}
              >
                {"\u2014"} {attribution}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
