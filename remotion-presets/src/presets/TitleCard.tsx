import { z } from "zod";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import rough from "roughjs";
import { useMemo, useCallback } from "react";
import { loadFont } from "@remotion/google-fonts/PlayfairDisplay";

const { fontFamily: serifFont } = loadFont("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

const AuthorSchema = z.object({
  name: z.string(),
  affiliation: z.string().optional(),
});

export const TitleCardSchema = z.object({
  title: z.string(),
  authors: z.array(AuthorSchema),
  subtitle: z.string().optional(),
  venue: z.string().optional(),
  year: z.string().optional(),
});

type TitleCardProps = z.infer<typeof TitleCardSchema>;

/**
 * Generate rough.js underline paths for decorative accents.
 */
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

/**
 * Generate rough.js rectangle for paper border accent.
 */
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

/**
 * Animated rough.js divider line beneath the title.
 */
// const RoughDivider: React.FC<{
//   x1: number;
//   y1: number;
//   x2: number;
//   y2: number;
//   progress: number;
//   seed: number;
//   color: string;
// }> = ({ x1, y1, x2, y2, progress, seed, color }) => {
//   const paths = useMemo(
//     () => generateRoughLine(x1, y1, x2, y2, seed),
//     [x1, y1, x2, y2, seed],
//   );
//   if (paths.length === 0 || progress <= 0) return null;
//   const clipWidth = (x2 - x1) * progress;
//   return (
//     <g>
//       <defs>
//         <clipPath id={`divider-clip-${seed}`}>
//           <rect x={x1} y={y1 - 10} width={clipWidth} height={20} />
//         </clipPath>
//       </defs>
//       <g clipPath={`url(#divider-clip-${seed})`}>
//         {paths.map((d, i) => (
//           <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} />
//         ))}
//       </g>
//     </g>
//   );
// };

/**
 * Rough.js paper border — drawn in as the paper settles.
 */
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

export const TitleCard: React.FC<TitleCardProps> = ({
  title,
  authors,
  subtitle,
  venue,
  year,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: compWidth, height: compHeight, durationInFrames } = useVideoConfig();

  // === PAPER CARD DIMENSIONS ===
  const cardW = 1400;
  const cardH = 880;
  void compWidth;
  void compHeight;

  // === ENTRANCE (0–2s): Scale + blur ===
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
  const bgColor = interpolate(frame, [0, 2 * fps], [255, 245], {
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

  // === 3D PERSPECTIVE TILT (0–4s): Paper landing ===
  const tiltProgress = interpolate(
    frame,
    [0, 4 * fps],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    },
  );
  const rotateX = interpolate(tiltProgress, [0, 1], [8, 0]);
  const rotateY = interpolate(tiltProgress, [0, 1], [-12, 0]);

  // === OUTRO (8–10s): Gentle tilt back + fade ===
  const outroStart = 8 * fps;
  const outroRotateY = interpolate(
    frame,
    [outroStart, durationInFrames],
    [0, 5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const outroFade = interpolate(
    frame,
    [outroStart, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) },
  );

  const finalRotateY = rotateY + outroRotateY;

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
  const lightOpacity = interpolate(frame, [0, 2 * fps, 4 * fps], [0.15, 0.08, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === TEXT REVEAL TIMING ===
  const titleStartFrame = 1.5 * fps;
  // Split title into lines (roughly 50 chars per line)
  const splitTitle = useCallback((text: string): string[] => {
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

  const titleLines = splitTitle(title);
  const lineStagger = 0.2 * fps; // 200ms between lines

  // Meta info (authors, venue, year) stagger
  const metaStartFrame = titleStartFrame + titleLines.length * lineStagger + 0.8 * fps;
  const metaStagger = 0.2 * fps;

  // Rough.js divider timing
  const dividerStartFrame = metaStartFrame - 0.3 * fps;
  const dividerDuration = 0.8 * fps;
  const dividerProgress = interpolate(
    frame,
    [dividerStartFrame, dividerStartFrame + dividerDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Rough.js border timing
  const borderProgress = interpolate(
    frame,
    [1 * fps, 3 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // === PAPER TEXTURE ===
  // Grain opacity: 0.14 on entrance → settles to 0.06 over 0.8s
  const grainOpacity = interpolate(
    frame,
    [0, 0.8 * fps],
    [0.14, 0.06],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const paperTexture = `
    radial-gradient(ellipse at ${lightX}% 30%, rgba(255,255,255,${lightOpacity}) 0%, transparent 60%),
    linear-gradient(160deg, #F5F0E8, #EDE8DC, #E8E2D4)
  `;

  // Coffee stain rings
  const coffeeStains = `
    radial-gradient(circle at 18% 75%, rgba(139,105,60,0.10) 0%, rgba(139,105,60,0.06) 6%, transparent 13%),
    radial-gradient(circle at 82% 22%, rgba(139,105,60,0.08) 0%, rgba(139,105,60,0.04) 7%, transparent 12%)
  `;

  // Edge vignette — darkens corners
  const edgeVignette = `radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(80,65,40,0.18) 100%)`;

  // Side yellowing — subtle aging on left/right edges
  const sideYellowing = `
    linear-gradient(to right, rgba(180,150,90,0.06) 0%, transparent 8%, transparent 92%, rgba(180,150,90,0.06) 100%)
  `;

  // === SHADOW ===
  const shadowBlur = interpolate(tiltProgress, [0, 1], [30, 20]);
  const shadowY = interpolate(tiltProgress, [0, 1], [15, 8]);
  const shadowOpacity = interpolate(tiltProgress, [0, 1], [0.15, 0.1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgb(${bgColor}, ${bgG}, ${bgB})`,
        opacity: outroFade,
      }}
    >
      {/* Ken Burns container */}
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${kenBurnsScale}) translate(${driftX}px, ${driftY}px)`,
          perspective: 1400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Paper card with 3D transform */}
        <div
          style={{
            width: cardW,
            height: cardH,
            transformStyle: "preserve-3d",
            transform: `scale(${entranceScale}) rotateX(${rotateX}deg) rotateY(${finalRotateY}deg)`,
            filter: entranceBlur > 0.1 ? `blur(${entranceBlur}px)` : undefined,
            position: "relative",
            borderRadius: 2,
            boxShadow: `0 ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity})`,
          }}
        >
          {/* Paper background — base + coffee stains + vignette + yellowing */}
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
            <filter id="paper-grain">
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
              filter: "url(#paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Corner fold — bottom-right triangle */}
          {/* <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 40,
              height: 40,
              background: "linear-gradient(135deg, transparent 50%, #D4CDB8 50%)",
              borderRadius: "0 0 2px 0",
              zIndex: 2,
            }}
          /> */}

          {/* Rough.js SVG overlay */}
          <svg
            width={cardW}
            height={cardH}
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
          >
            {/* Paper border accent */}
            <RoughBorder
              x={16}
              y={16}
              w={cardW - 32}
              h={cardH - 32}
              progress={borderProgress}
              seed={7}
            />

            {/* Divider line beneath title */}
            {/* <RoughDivider
              x1={100}
              y1={200 + titleLines.length * 64 + 16}
              x2={cardW - 100}
              y2={200 + titleLines.length * 64 + 16}
              progress={dividerProgress}
              seed={42}
              color="rgba(0, 0, 0, 0.2)"
            /> */}

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
            {/* Title — line by line reveal */}
            <div style={{ marginBottom: 24 }}>
              {titleLines.map((line, idx) => {
                const lineStart = titleStartFrame + idx * lineStagger;
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
                      lineHeight: "64px",
                      color: "#1a1a1a",
                      opacity: lineOpacity,
                      transform: `translateY(${lineTranslateY}px)`,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {line}
                  </div>
                );
              })}
            </div>

            {/* Subtitle */}
            {subtitle && (() => {
              const subtitleStart = metaStartFrame - 0.3 * fps;
              const subtitleOpacity = interpolate(
                frame,
                [subtitleStart, subtitleStart + 0.5 * fps],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              const subtitleY = interpolate(
                frame,
                [subtitleStart, subtitleStart + 0.5 * fps],
                [10, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.quad),
                },
              );
              return (
                <div
                  style={{
                    fontFamily: serifFont,
                    fontSize: 40,
                    fontWeight: 400,
                    fontStyle: "italic",
                    color: "#555",
                    opacity: subtitleOpacity,
                    transform: `translateY(${subtitleY}px)`,
                    marginBottom: 32,
                    lineHeight: "45px",
                    maxWidth: 900,
                  }}
                >
                  {subtitle}
                </div>
              );
            })()}

            {/* Authors */}
            <div style={{ marginBottom: 24 }}>
              {authors.map((author, idx) => {
                const authorStart = metaStartFrame + idx * metaStagger;
                const authorOpacity = interpolate(
                  frame,
                  [authorStart, authorStart + 0.4 * fps],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );
                const authorY = interpolate(
                  frame,
                  [authorStart, authorStart + 0.4 * fps],
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
                      fontSize: 35,
                      color: "#333",
                      opacity: authorOpacity,
                      transform: `translateY(${authorY}px)`,
                      lineHeight: "40px",
                    }}
                  >
                    {author.name}
                    {author.affiliation && (
                      <span style={{ color: "#888", fontSize: 24 }}>
                        {" "}— {author.affiliation}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Venue + Year */}
            {(venue || year) && (() => {
              const venueStart = metaStartFrame + authors.length * metaStagger + 0.2 * fps;
              const venueOpacity = interpolate(
                frame,
                [venueStart, venueStart + 0.4 * fps],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              const venueY = interpolate(
                frame,
                [venueStart, venueStart + 0.4 * fps],
                [10, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.quad),
                },
              );
              return (
                <div
                  style={{
                    fontFamily: serifFont,
                    fontSize: 34,
                    color: "#777",
                    opacity: venueOpacity,
                    transform: `translateY(${venueY}px)`,
                    marginTop: 8,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {venue}
                  {venue && year && " · "}
                  {year}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
