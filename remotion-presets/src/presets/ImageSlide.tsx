import { z } from "zod";
import {
  AbsoluteFill,
  Img,
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

// ── Seeded LCG for deterministic typewriter jitter ──
function createLCG(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}

// ── Zod Schema ──

const AnnotationSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string(),
  shape: z.enum(["rect", "circle"]).default("rect"),
});

const ZoomRegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  scale: z.number().default(1.5),
});

export const ImageSlideSchema = z.object({
  title: z.string().optional(),
  figureLabel: z.string().optional(),
  imageSrc: z.string(),
  caption: z.string(),
  annotations: z.array(AnnotationSchema).optional(),
  zoomRegion: ZoomRegionSchema.optional(),
  imageHeight: z.number().optional(),
});

type ImageSlideProps = z.infer<typeof ImageSlideSchema>;

// ── Rough.js helpers (verbatim from TitleCard) ──

function generateRoughRect(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  options?: { roughness?: number; stroke?: string; strokeWidth?: number },
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
    fill: "none",
  });
  const paths: string[] = [];
  node.querySelectorAll("path").forEach((p) => {
    const d = p.getAttribute("d");
    if (d) paths.push(d);
  });
  return paths;
}

function generateRoughEllipse(
  cx: number,
  cy: number,
  w: number,
  h: number,
  seed: number,
  options?: { roughness?: number; stroke?: string; strokeWidth?: number },
): string[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);
  const node = rc.ellipse(cx, cy, w, h, {
    roughness: options?.roughness ?? 1.6,
    bowing: 1,
    seed,
    stroke: options?.stroke ?? "#CC3333",
    strokeWidth: options?.strokeWidth ?? 2.5,
    fill: "none",
  });
  const paths: string[] = [];
  node.querySelectorAll("path").forEach((p) => {
    const d = p.getAttribute("d");
    if (d) paths.push(d);
  });
  return paths;
}

// ── RoughBorder (verbatim from TitleCard) ──

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

// ── Main Component ──

export const ImageSlide: React.FC<ImageSlideProps> = ({
  title,
  figureLabel,
  imageSrc,
  caption,
  annotations = [],
  zoomRegion,
  imageHeight: imageHeightProp,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: compWidth, height: compHeight, durationInFrames } = useVideoConfig();
  void compWidth;
  void compHeight;

  // === PAPER CARD DIMENSIONS ===
  const cardW = 1400;
  const cardH = 880;
  const imgMaxH = imageHeightProp ?? 300;

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

  // === IDLE OSCILLATION ===
  const idleOscillation = Math.sin((frame / fps) * Math.PI * 0.22) * 2;

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

  const finalRotateY = rotateY + outroRotateY + idleOscillation;

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

  const titleLines = title ? splitTitle(title) : [];
  const lineStagger = 0.2 * fps;

  // Title reveal end frame
  const titleRevealEnd = titleStartFrame + titleLines.length * lineStagger + 0.6 * fps;

  // Figure label timing
  const figureLabelStart = titleRevealEnd + 0.2 * fps;

  // === IMAGE REVEAL ===
  const imageRevealStart = 1.0 * fps;
  const imageRevealEnd = imageRevealStart + 1.2 * fps;
  const imageClipProgress = interpolate(
    frame,
    [imageRevealStart, imageRevealEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // === ANNOTATION TIMING ===
  const annotationStartBase = imageRevealEnd + 0.5 * fps;
  const annotationDrawDuration = 0.6 * fps;
  const annotationStagger = 0.6 * fps;
  const allAnnotationsEnd = annotationStartBase + annotations.length * annotationStagger + annotationDrawDuration;

  // === ZOOM REGION ===
  const zoomTranslateX = zoomRegion
    ? interpolate(
        frame,
        [allAnnotationsEnd, durationInFrames],
        [0, -(zoomRegion.x + zoomRegion.width / 2 - 0.5) * imgMaxH * 1.6],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;
  const zoomTranslateY = zoomRegion
    ? interpolate(
        frame,
        [allAnnotationsEnd, durationInFrames],
        [0, -(zoomRegion.y + zoomRegion.height / 2 - 0.5) * imgMaxH],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;
  const zoomScale = zoomRegion
    ? interpolate(
        frame,
        [allAnnotationsEnd, durationInFrames],
        [1.0, zoomRegion.scale],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 1.0;

  // === CAPTION TYPEWRITER ===
  const captionStartFrame = imageRevealEnd + 0.3 * fps;
  const charDuration = (40 / 1000) * fps; // 40ms per char
  const captionLCG = useMemo(() => createLCG(42), []);
  const captionJitters = useMemo(() => {
    const lcg = createLCG(42);
    return caption.split("").map(() => lcg() * 0.4 + 0.8); // jitter multiplier 0.8–1.2
  }, [caption]);

  const visibleCaptionChars = useMemo(() => {
    let elapsed = frame - captionStartFrame;
    if (elapsed <= 0) return 0;
    let count = 0;
    let time = 0;
    for (let i = 0; i < caption.length; i++) {
      time += charDuration * (captionJitters[i] ?? 1);
      if (elapsed >= time) {
        count = i + 1;
      } else {
        break;
      }
    }
    return count;
  }, [frame, captionStartFrame, caption, charDuration, captionJitters]);

  // === ROUGH.JS BORDER TIMING ===
  const borderProgress = interpolate(
    frame,
    [1 * fps, 3 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // === ROUGH.JS IMAGE BORDER ===
  // Drawn in clockwise over 0.6s after entrance settles (at ~2s)
  const imgBorderStart = 2 * fps;
  const imgBorderProgress = interpolate(
    frame,
    [imgBorderStart, imgBorderStart + 0.6 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // We need image dimensions for the border — use full card inner width
  const imgAreaW = cardW - 200; // 100px padding each side
  const imgBorderPaths = useMemo(
    () =>
      generateRoughRect(0, 0, imgAreaW, imgMaxH, 99, {
        roughness: 0.6,
        stroke: "rgba(0,0,0,0.15)",
        strokeWidth: 1.2,
      }),
    [imgAreaW, imgMaxH],
  );

  // === ROUGH.JS ANNOTATION PATHS ===
  const annotationPaths = useMemo(() => {
    return annotations.map((ann, idx) => {
      const absX = ann.x * imgAreaW;
      const absY = ann.y * imgMaxH;
      const absW = ann.width * imgAreaW;
      const absH = ann.height * imgMaxH;

      if (ann.shape === "circle") {
        return generateRoughEllipse(
          absX + absW / 2,
          absY + absH / 2,
          absW,
          absH,
          200 + idx,
          { roughness: 1.6, stroke: "#CC3333", strokeWidth: 2.5 },
        );
      }
      return generateRoughRect(absX, absY, absW, absH, 200 + idx, {
        roughness: 1.6,
        stroke: "#CC3333",
        strokeWidth: 2.5,
      });
    });
  }, [annotations, imgAreaW, imgMaxH]);

  // === PAPER TEXTURE ===
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

  const coffeeStains = `
    radial-gradient(circle at 18% 75%, rgba(139,105,60,0.10) 0%, rgba(139,105,60,0.06) 6%, transparent 13%),
    radial-gradient(circle at 82% 22%, rgba(139,105,60,0.08) 0%, rgba(139,105,60,0.04) 7%, transparent 12%)
  `;

  const edgeVignette = `radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(80,65,40,0.18) 100%)`;

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
            <filter id="imageslide-paper-grain">
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
              filter: "url(#imageslide-paper-grain)",
              opacity: grainOpacity,
              backgroundColor: "rgba(200,190,170,0.3)",
              mixBlendMode: "multiply",
            }}
          />

          {/* Rough.js SVG overlay — paper border */}
          <svg
            width={cardW}
            height={cardH}
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
          >
            <RoughBorder
              x={16}
              y={16}
              w={cardW - 32}
              h={cardH - 32}
              progress={borderProgress}
              seed={7}
            />
          </svg>

          {/* Content */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: "60px 100px",
              display: "flex",
              flexDirection: "column",
              zIndex: 1,
            }}
          >
            {/* Figure label */}
            {figureLabel && (() => {
              const flOpacity = interpolate(
                frame,
                [figureLabelStart, figureLabelStart + 0.4 * fps],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              const flY = interpolate(
                frame,
                [figureLabelStart, figureLabelStart + 0.4 * fps],
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
                    fontFamily: "'Courier New', monospace",
                    fontSize: 22,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    opacity: flOpacity,
                    transform: `translateY(${flY}px)`,
                    marginBottom: 8,
                  }}
                >
                  {figureLabel}
                </div>
              );
            })()}

            {/* Title — line by line reveal */}
            {title && (
              <div style={{ marginBottom: 16 }}>
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
                        fontSize: 44,
                        fontWeight: 700,
                        lineHeight: "54px",
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
            )}

            {/* Image area with polaroid reveal */}
            <div
              style={{
                position: "relative",
                width: imgAreaW,
                height: imgMaxH,
                alignSelf: "center",
                flexShrink: 0,
              }}
            >
              {/* SVG filters for polaroid clip displacement */}
              <svg width="0" height="0" style={{ position: "absolute" }}>
                <defs>
                  <filter id="imageslide-displacement">
                    <feTurbulence
                      type="turbulence"
                      baseFrequency="0.04"
                      numOctaves="3"
                      result="turbulence"
                    />
                    <feDisplacementMap
                      in="SourceGraphic"
                      in2="turbulence"
                      scale="18"
                      xChannelSelector="R"
                      yChannelSelector="G"
                    />
                  </filter>
                  <clipPath id="imageslide-reveal-clip">
                    <rect
                      x="0"
                      y="0"
                      width={imgAreaW}
                      height={imageClipProgress * imgMaxH}
                      filter={imageClipProgress < 1 ? "url(#imageslide-displacement)" : undefined}
                    />
                  </clipPath>
                </defs>
              </svg>

              {/* Zoom + annotation wrapper — zoom applies only here */}
              <div
                style={{
                  position: "relative",
                  width: imgAreaW,
                  height: imgMaxH,
                  transform: `translate(${zoomTranslateX}px, ${zoomTranslateY}px) scale(${zoomScale})`,
                  transformOrigin: "center center",
                }}
              >
                {/* Image with clip reveal */}
                <div
                  style={{
                    width: imgAreaW,
                    height: imgMaxH,
                    clipPath: "url(#imageslide-reveal-clip)",
                    position: "relative",
                  }}
                >
                  <Img
                    src={imageSrc}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>

                {/* Annotation SVG overlay */}
                {annotations.length > 0 && (
                  <svg
                    width={imgAreaW}
                    height={imgMaxH}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      pointerEvents: "none",
                      zIndex: 2,
                    }}
                  >
                    {annotations.map((ann, idx) => {
                      const annStart = annotationStartBase + idx * annotationStagger;
                      const annDrawProgress = interpolate(
                        frame,
                        [annStart, annStart + annotationDrawDuration],
                        [0, 1],
                        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                      );

                      const paths = annotationPaths[idx] ?? [];
                      if (annDrawProgress <= 0) return null;

                      const absX = ann.x * imgAreaW;
                      const absY = ann.y * imgMaxH;
                      const absW = ann.width * imgAreaW;
                      const absH = ann.height * imgMaxH;

                      // Clip expands rightward then downward
                      const clipW = interpolate(annDrawProgress, [0, 0.5, 1], [0, absW, absW], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      });
                      const clipH = interpolate(annDrawProgress, [0, 0.5, 1], [absH, absH, absH], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      });

                      const clipId = `ann-clip-${idx}`;

                      // Label typewriter — starts after shape finishes
                      const labelStart = annStart + annotationDrawDuration;
                      const labelLCG = createLCG(300 + idx);
                      const labelJitters = ann.label.split("").map(() => labelLCG() * 0.4 + 0.8);
                      const labelCharDuration = (40 / 1000) * fps;
                      let labelVisibleChars = 0;
                      {
                        let elapsed = frame - labelStart;
                        if (elapsed > 0) {
                          let time = 0;
                          for (let i = 0; i < ann.label.length; i++) {
                            time += labelCharDuration * (labelJitters[i] ?? 1);
                            if (elapsed >= time) labelVisibleChars = i + 1;
                            else break;
                          }
                        }
                      }

                      return (
                        <g key={idx}>
                          <defs>
                            <clipPath id={clipId}>
                              <rect x={absX} y={absY} width={clipW} height={clipH} />
                            </clipPath>
                          </defs>
                          <g clipPath={`url(#${clipId})`}>
                            {paths.map((d, i) => (
                              <path
                                key={i}
                                d={d}
                                fill="none"
                                stroke="#CC3333"
                                strokeWidth={2.5}
                              />
                            ))}
                          </g>
                          {labelVisibleChars > 0 && (
                            <text
                              x={absX}
                              y={absY - 8}
                              fontFamily="'Courier New', monospace"
                              fontSize={20}
                              fill="#CC3333"
                            >
                              {ann.label.slice(0, labelVisibleChars)}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>

              {/* Rough.js image border */}
              {imgBorderProgress > 0 && (
                <svg
                  width={imgAreaW}
                  height={imgMaxH}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    pointerEvents: "none",
                  }}
                >
                  <g style={{ opacity: imgBorderProgress }}>
                    {imgBorderPaths.map((d, i) => (
                      <path
                        key={i}
                        d={d}
                        fill="none"
                        stroke="rgba(0,0,0,0.15)"
                        strokeWidth={1.2}
                      />
                    ))}
                  </g>
                </svg>
              )}
            </div>

            {/* Caption — typewriter effect */}
            <div
              style={{
                fontFamily: serifFont,
                fontSize: 24,
                fontStyle: "italic",
                color: "#777",
                marginTop: 16,
                minHeight: 30,
                alignSelf: "center",
                textAlign: "center",
                maxWidth: imgAreaW,
              }}
            >
              {visibleCaptionChars > 0 ? caption.slice(0, visibleCaptionChars) : ""}
              {visibleCaptionChars > 0 && visibleCaptionChars < caption.length && (
                <span style={{ opacity: frame % (fps / 4) < fps / 8 ? 1 : 0 }}>|</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
