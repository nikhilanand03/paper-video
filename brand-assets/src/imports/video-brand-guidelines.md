# Video Template Brand Guidelines

## Four Visual Directions

Each direction below is a complete, self-contained brand guideline. They share the same constraint: all designs are for video frames at 1920x1080, viewed on screens at a distance, with voiceover. Text must be large. Data density must be low. Animations must be deliberate.

Pick one, mix elements from multiple, or use them as starting points in Figma Make.

---
---

# Direction A: "Light Editorial"

*Feels like a beautifully typeset Nature article or a Stripe blog post rendered as a video. Clean, authoritative, readable. Stands out because almost all tech/science video content uses dark themes.*

---

## A.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| bg-primary | #FAFAF8 | Main background. Warm off-white, not sterile pure white. |
| bg-surface | #FFFFFF | Card and table surfaces. True white lifts them off the warm background. |
| bg-code | #F4F4F0 | Code snippets, monospace blocks, equation backgrounds. |
| text-primary | #1A1A1A | Headlines and body text. Near-black for maximum readability. |
| text-secondary | #6B7280 | Captions, labels, axis labels, source citations. |
| text-dim | #9CA3AF | Tertiary info, decorative numbers, watermarks. |
| accent-primary | #2563EB | Primary accent. Confident blue. Used for highlights, chart emphasis, active states. |
| accent-secondary | #7C3AED | Purple. Used for secondary data series, alternate emphasis. |
| accent-positive | #059669 | Green. "Our method wins" indicators, positive deltas, upward trends. |
| accent-negative | #DC2626 | Red. Baseline/previous work in charts, negative deltas, downward trends. |
| accent-amber | #D97706 | Amber. Warnings, notable callouts, third data series. |
| border | #E5E7EB | Card borders, table gridlines, dividers. Subtle, not heavy. |
| border-accent | rgba(37, 99, 235, 0.2) | Blue-tinted border for highlighted cards, active elements. |

**Rules:**
- Background is always warm off-white (#FAFAF8), never pure white (#FFFFFF) for the scene background.
- Maximum 2 accent colors per scene. If a chart has 5 series, use 2 accents + 3 grays.
- Highlighted/winning data always uses accent-primary (blue). Previous work uses text-secondary (gray).

## A.2 Typography

| Role | Font | Weight | Size | Tracking |
|---|---|---|---|---|
| Title | Instrument Serif | 400 | 60px | -1px |
| Heading | Inter | 600 | 38px | -0.5px |
| Body | Inter | 400 | 24px | 0 |
| Caption | Inter | 400 | 16px | 0.2px |
| Numbers/Data | IBM Plex Mono | 500 | 22px | 0 |
| Equation | KaTeX default (Latin Modern) | — | 32px | — |

**Rules:**
- Instrument Serif is ONLY for the title_card template (paper title). All other headings use Inter.
- Numbers in tables and charts always use IBM Plex Mono for alignment and legibility.
- Maximum 3 font sizes per scene. If you need more hierarchy, use weight and color, not more sizes.
- Line height: 1.2 for headings, 1.6 for body, 1.0 for data/numbers.

## A.3 Spacing & Layout

- **Frame:** 1920x1080
- **Safe zone padding:** 96px top/bottom, 128px left/right
- **Content area:** 1664 x 888
- **Grid:** 12 columns, 24px gutter
- **Card padding:** 32px inner
- **Card gap:** 24px between cards
- **Card corner radius:** 12px
- **Section heading margin-bottom:** 40px

**Rules:**
- Content is left-aligned by default. Center alignment only for title_card and big_number templates.
- Tables and charts stretch to full content width. Never float them in the middle with dead space on both sides.
- Vertical rhythm: every element snaps to an 8px grid.

## A.4 Cards & Surfaces

- Cards have a 1px border (#E5E7EB), 12px radius, white (#FFFFFF) background.
- Shadow: `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)`. Very subtle, just enough to lift.
- Highlighted card: border changes to accent-primary (blue) with 2px weight, shadow intensifies slightly.
- Dimmed card: opacity 0.5, border stays gray.

## A.5 Tables

- Header row: bg #F9FAFB, text accent-primary, font-weight 600, uppercase, letter-spacing 1px, font-size 15px.
- Body rows: alternating #FFFFFF and #F9FAFB. Text #1A1A1A.
- Highlighted row: bg rgba(37, 99, 235, 0.06), left border 3px solid accent-primary.
- Best row: text accent-primary, font-weight 600.
- Cell padding: 16px vertical, 24px horizontal.
- Gridlines: 1px #E5E7EB horizontal only. No vertical gridlines.
- Numbers: right-aligned, IBM Plex Mono.
- Text columns: left-aligned, Inter.

## A.6 Charts

- Axis lines: 1px #D1D5DB.
- Gridlines: 1px #F3F4F6 (barely visible). Horizontal only.
- Axis labels: 16px Inter 400, color #6B7280.
- Data labels (on bars/points): 18px IBM Plex Mono 500, color #1A1A1A.
- Bars: 48px wide, 8px corner radius on top. Fill accent-primary for highlighted, #D1D5DB for baseline.
- Lines: 3px stroke width, round caps. Dots at data points: 8px diameter.
- Legend: positioned top-right, 14px Inter, color swatches 12x12px with 4px radius.
- Chart area has a very subtle background (#FAFAFA) to separate it from the card surface.
- Donut charts: 200px outer radius, 120px inner radius. 4px gap between segments.
- Heatmap cells: 4px gap, 6px corner radius.

## A.7 Animation Principles

- Easing: ease-out (cubic-bezier(0.16, 1, 0.3, 1)) for entrances. Smooth deceleration.
- Duration: 0.5-0.7s for individual elements. Never faster than 0.3s, never slower than 1.0s.
- Stagger: 0.15-0.3s between sequential items (bullet points, table rows, bars).
- Entrance direction: slide up + fade for text, scale up + fade for numbers, grow from baseline for bars, draw left-to-right for lines.
- Total animation budget: first 25-35% of scene duration. Rest is static hold.
- No bouncing, no overshoot, no playful animations. This is editorial, it should feel composed and measured.

## A.8 Figma Make Prompt

```
Design a video frame template at 1920x1080 pixels. Style: light editorial, 
like a beautifully typeset Nature article or Stripe blog rendered as video. 
Background: warm off-white #FAFAF8. Cards: white with subtle shadow. 
Text: near-black #1A1A1A. Primary accent: confident blue #2563EB. 
Typography: Instrument Serif for titles only, Inter for everything else, 
IBM Plex Mono for numbers and data. Minimal, authoritative, high contrast. 
Very generous whitespace. No decorative elements except subtle borders. 
Content must be readable from 3 feet away on a laptop screen.
```

---
---

# Direction B: "Bloomberg Terminal"

*Feels like a premium financial data terminal. Dense but precise, dark background, monospace everything, cyan/green on black. Signals serious data credibility. For papers with heavy quantitative results.*

---

## B.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| bg-primary | #0A0A0A | Deep black. Not navy, not gray. Black. |
| bg-surface | #141414 | Card surfaces. Very slightly lifted off pure black. |
| bg-elevated | #1E1E1E | Header rows, active panels, tooltips. |
| text-primary | #E0E0E0 | Main text. Not pure white (too harsh). Warm light gray. |
| text-secondary | #808080 | Labels, captions, inactive text. Medium gray. |
| text-dim | #4A4A4A | Decorative, watermarks, disabled state. |
| accent-primary | #00D4AA | Signature cyan-green. Terminal green. Used for positive values, primary highlights. |
| accent-secondary | #FF6B35 | Warm orange. Used for secondary data series, warnings, attention. |
| accent-positive | #00D4AA | Same as primary. Up arrows, gains, improvements. |
| accent-negative | #FF4444 | Red. Losses, regressions, errors. |
| accent-blue | #4A9EFF | Blue. Third data series, links, informational. |
| accent-amber | #FFB800 | Yellow-amber. Alerts, notable callouts. |
| border | #2A2A2A | Borders and dividers. Just barely visible. |
| border-accent | rgba(0, 212, 170, 0.3) | Green-tinted border for active/highlighted. |

**Rules:**
- Pure black backgrounds. No gradients, no glows, no ambient lighting. Clean and harsh.
- Accent-primary (cyan-green) is the dominant accent. Used sparingly for maximum impact.
- White text is never pure #FFFFFF. Always #E0E0E0 to reduce eye strain.
- Charts can use up to 4 colors: accent-primary, accent-secondary, accent-blue, text-secondary.

## B.2 Typography

| Role | Font | Weight | Size | Tracking |
|---|---|---|---|---|
| Title | Space Grotesk | 700 | 52px | -1.5px |
| Heading | Space Grotesk | 600 | 34px | -0.5px |
| Body | Space Grotesk | 400 | 22px | 0 |
| Caption | Space Mono | 400 | 14px | 0.5px |
| Numbers/Data | Space Mono | 500 | 24px | 1px |
| Equation | KaTeX default | — | 32px | — |

**Rules:**
- Monospace (Space Mono) is used heavily: all numbers, all captions, axis labels, table data cells. This is the defining typographic choice.
- Space Grotesk for all prose text (titles, headings, body, bullet points).
- Uppercase + wide letter-spacing for section labels and table headers.
- Numbers are the stars. They should be large and prominent. Data values: 24px minimum.

## B.3 Spacing & Layout

- **Frame:** 1920x1080
- **Safe zone padding:** 64px all sides (tighter than editorial; more data density)
- **Content area:** 1792 x 952
- **Card padding:** 24px inner
- **Card gap:** 16px (tighter)
- **Card corner radius:** 4px (nearly sharp; terminal aesthetic)
- **Section heading margin-bottom:** 32px

**Rules:**
- Higher information density than other directions. Can fit more rows in a table, more bars in a chart.
- Left-aligned by default. Monospace numbers always right-aligned.
- Subtle 1px separator lines between sections, not whitespace.

## B.4 Cards & Surfaces

- Cards: 1px border #2A2A2A, 4px radius, bg #141414. No shadow. Flat.
- Highlighted card: border #00D4AA, subtle inner glow (box-shadow: inset 0 0 20px rgba(0, 212, 170, 0.05)).
- Dimmed card: opacity 0.4.
- Active state feedback: border pulses briefly (opacity animation on border-color).

## B.5 Tables

- Header row: bg #1E1E1E, text accent-primary (#00D4AA), uppercase, Space Mono 14px, letter-spacing 2px.
- Body rows: alternating #0A0A0A and #141414. Very subtle contrast.
- Highlighted row: bg rgba(0, 212, 170, 0.06), left border 2px solid accent-primary.
- Cell padding: 12px vertical, 20px horizontal (tighter than editorial).
- All gridlines: 1px #1E1E1E. Both horizontal and vertical (terminal grid look).
- Numbers always monospace, always right-aligned.
- Negative values in red. Positive values in green. Neutral in gray.

## B.6 Charts

- Axis lines: 1px #2A2A2A.
- Gridlines: 1px #1A1A1A (barely visible). Both horizontal and vertical (grid paper effect).
- Axis labels: 14px Space Mono 400, color #808080.
- Data labels: 16px Space Mono 500, color #E0E0E0.
- Bars: 40px wide, 2px corner radius (nearly square). Fill accent-primary for highlighted.
- Lines: 2px stroke width, sharp joins (not round). No dots at data points unless hovered/active.
- Legend: top-right or inline at end of lines. Space Mono 12px.
- No chart area background. Chart sits directly on the card surface.
- Heatmap cells: 2px gap, 2px corner radius. Color scale from bg-surface to accent-primary.

## B.7 Animation Principles

- Easing: linear or ease-in-out. No playful easing curves. Mechanical, precise.
- Duration: 0.3-0.5s. Faster than editorial. Data appears quickly.
- Stagger: 0.08-0.15s. Rapid-fire sequential reveals.
- Entrance: fade only. No sliding, no scaling. Elements materialize in place.
- Bars grow from baseline, but quickly (0.3s per bar).
- Lines draw instantly (0.5s total, no gradual trace).
- Total animation budget: first 15-20% of scene. The data should be visible quickly so the viewer can study it while listening.

## B.8 Figma Make Prompt

```
Design a video frame template at 1920x1080 pixels. Style: Bloomberg Terminal / 
financial data dashboard. Pure black background #0A0A0A. Cyan-green accent 
#00D4AA. All numbers in Space Mono monospace font with wide letter-spacing. 
Headlines in Space Grotesk. Sharp corners (4px radius max). No shadows, no 
gradients. Dense layout with thin grid lines. Text #E0E0E0 on black. 
This should feel like a premium real-time data feed, not a presentation.
Precise, clinical, information-dense. Every pixel serves a purpose.
```

---
---

# Direction C: "Modern Research Dashboard"

*Feels like a well-designed SaaS analytics dashboard. Dark navy background (not black), card-based layout, soft glows, indigo/cyan palette. Approachable but technical. The middle ground.*

---

## C.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| bg-primary | #0B0E14 | Deep dark navy. Warmer than pure black, cooler than Bloomberg's flat black. |
| bg-surface | #141820 | Card backgrounds. Noticeably lighter than the scene bg. |
| bg-elevated | #1C2130 | Hovered states, header rows, tooltips. |
| text-primary | #E8ECF4 | Near-white with a cool tint. Feels modern. |
| text-secondary | #7A849B | Muted blue-gray for labels and captions. |
| text-dim | #4A5168 | Tertiary/decorative text. |
| accent-primary | #818CF8 | Indigo. The signature color. Buttons, highlights, active states. |
| accent-secondary | #22D3EE | Cyan. Secondary highlights, "our result" in charts. |
| accent-positive | #34D399 | Emerald green. Positive deltas, improvements. |
| accent-negative | #FB7185 | Rose. Negative deltas, regressions. Soft red, not aggressive. |
| accent-amber | #FBBF24 | Amber. Warnings, third data series, stars. |
| border | rgba(122, 132, 155, 0.12) | Very subtle borders. Cards are defined by background contrast, not borders. |
| border-accent | rgba(129, 140, 248, 0.25) | Indigo glow border for active elements. |

**Rules:**
- Background has a subtle radial gradient glow in the top-right corner (indigo at 5% opacity, 800px radius). This adds atmosphere without distracting.
- Cards "float" on the background via background contrast + subtle shadow, not heavy borders.
- Accent-primary (indigo) and accent-secondary (cyan) are the main pair. Use emerald/rose only for positive/negative semantics.

## C.2 Typography

| Role | Font | Weight | Size | Tracking |
|---|---|---|---|---|
| Title | DM Sans | 700 | 56px | -1.5px |
| Heading | DM Sans | 600 | 36px | -0.5px |
| Body | DM Sans | 400 | 24px | 0 |
| Caption | DM Sans | 400 | 16px | 0.2px |
| Numbers/Data | JetBrains Mono | 500 | 22px | 0.5px |
| Equation | KaTeX default | — | 32px | — |

**Rules:**
- DM Sans throughout. Clean geometric sans-serif that feels modern without being cold.
- JetBrains Mono for all numeric data. The ligatures and designed-for-code aesthetic fits the technical audience.
- No uppercase transforms except section labels and table headers.
- Headlines use negative letter-spacing for a tight, modern feel.

## C.3 Spacing & Layout

- **Frame:** 1920x1080
- **Safe zone padding:** 80px top/bottom, 120px left/right
- **Content area:** 1680 x 920
- **Card padding:** 32px inner
- **Card gap:** 20px
- **Card corner radius:** 16px (softer, modern)
- **Section heading margin-bottom:** 40px

**Rules:**
- Comfortable density. Not as sparse as Editorial, not as dense as Bloomberg.
- Cards have generous internal padding. Content never feels cramped.
- Left-aligned by default. Center only for big_number and title_card.

## C.4 Cards & Surfaces

- Cards: bg #141820, border rgba(122, 132, 155, 0.12), 16px radius.
- Shadow: `0 4px 24px rgba(0, 0, 0, 0.4)`. Noticeable but not heavy.
- Highlighted card: border-color shifts to indigo (rgba(129, 140, 248, 0.25)), add outer glow `0 0 40px rgba(129, 140, 248, 0.08)`.
- Dimmed card: opacity 0.5.

## C.5 Tables

- Header row: bg #1C2130, text accent-primary (#818CF8), font-weight 600, uppercase, 16px, letter-spacing 1.2px.
- Body rows: alternating #141820 and rgba(20, 24, 32, 0.5). Subtle.
- Highlighted row: bg rgba(129, 140, 248, 0.08), left border 3px solid indigo.
- Best row: text cyan (#22D3EE), font-weight 600.
- Cell padding: 18px vertical, 28px horizontal.
- Gridlines: 1px rgba(122, 132, 155, 0.08) horizontal only.
- Numbers: JetBrains Mono, right-aligned.

## C.6 Charts

- Axis lines: 1px rgba(122, 132, 155, 0.2).
- Gridlines: 1px rgba(122, 132, 155, 0.06). Horizontal only. Nearly invisible.
- Axis labels: 14px DM Sans 400, color #7A849B.
- Data labels: 18px JetBrains Mono 500, color #E8ECF4.
- Bars: 48px wide, 8px top radius. Fill indigo for baseline, cyan for highlighted.
- Lines: 2.5px stroke, round caps. Dots: 7px diameter with 2px white ring.
- Legend: top-right. DM Sans 14px. Color dots 10px with 5px radius.
- Donut: 180px outer, 110px inner. 3px segment gap.
- Heatmap: 4px gap, 8px radius. Indigo intensity scale.

## C.7 Animation Principles

- Easing: cubic-bezier(0.16, 1, 0.3, 1). Smooth ease-out with a touch of spring.
- Duration: 0.5-0.8s per element.
- Stagger: 0.15-0.25s.
- Entrance: slide up (20px) + fade for text. Scale (from 0.85) + fade for numbers/cards. Grow from baseline for bars.
- Lines trace left-to-right over 1.5s.
- Ambient glow in background pulses very subtly (opacity: 0.04 to 0.07, 4s cycle). Optional, adds life without distracting.
- Total animation budget: first 25-30% of scene.

## C.8 Figma Make Prompt

```
Design a video frame template at 1920x1080 pixels. Style: modern SaaS analytics 
dashboard. Dark navy background #0B0E14 with a subtle radial indigo glow in the 
top-right corner. Cards: #141820 with 16px radius and soft shadow. Text: 
cool-tinted off-white #E8ECF4. Primary accent: indigo #818CF8, secondary: 
cyan #22D3EE. Typography: DM Sans for text, JetBrains Mono for numbers. 
Comfortable spacing, modern and approachable but still professional. Soft glows 
on highlighted elements. This should feel like Linear or Vercel's dashboard, 
not a presentation slide.
```

---
---

# Direction D: "Apple Keynote"

*Feels like an Apple product announcement. Near-black background, massive white text, one thing on screen at a time, extreme negative space. Every frame is a billboard. Maximum impact, minimum clutter.*

---

## D.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| bg-primary | #000000 | Pure black. No compromise. |
| bg-surface | #1C1C1E | iOS system gray 6. Card surfaces, panels. |
| bg-elevated | #2C2C2E | iOS system gray 5. Secondary surfaces. |
| text-primary | #FFFFFF | Pure white. Bold, high contrast. |
| text-secondary | #8E8E93 | iOS system gray. Labels, captions. |
| text-dim | #48484A | iOS system gray 3. Decorative only. |
| accent-primary | #0A84FF | iOS blue. The only accent needed for most scenes. |
| accent-secondary | #30D158 | iOS green. Positive/success. |
| accent-negative | #FF453A | iOS red. Negative/error. |
| accent-purple | #BF5AF2 | iOS purple. Alternate accent for variety. |
| accent-amber | #FFD60A | iOS yellow. Occasional third accent. |
| border | none | No visible borders. Elements defined by background contrast and spacing alone. |
| border-accent | none | No bordered highlights. Use background color change instead. |

**Rules:**
- No borders anywhere. Zero. Elements are defined by background contrast and generous spacing.
- No shadows. Flat. Depth is created by background color layers only.
- No gradients except for occasional full-frame background gradients (e.g., dark blue to black for variety).
- One accent color per scene maximum. Usually accent-primary (blue).
- Extreme restraint. If you think a scene needs more decoration, remove something instead.

## D.2 Typography

| Role | Font | Weight | Size | Tracking |
|---|---|---|---|---|
| Title | SF Pro Display (or Inter as fallback) | 700 | 72px | -2px |
| Heading | SF Pro Display | 600 | 48px | -1px |
| Body | SF Pro Text (or Inter as fallback) | 400 | 28px | 0 |
| Caption | SF Pro Text | 400 | 18px | 0 |
| Numbers/Data | SF Mono (or JetBrains Mono as fallback) | 600 | 36px | 0 |
| Equation | KaTeX default | — | 40px | — |

**Rules:**
- SF Pro is ideal but not available on non-Apple platforms. Inter is the web fallback. The design should work with both.
- Text is LARGE. Body at 28px, headings at 48px, titles at 72px. This is a billboard, not a document.
- Numbers in charts and big_number are enormous (36px+). They're the focal point.
- Maximum 2 text sizes per scene. Hierarchy through weight and color, not size proliferation.
- Line height: tight. 1.1 for headlines, 1.4 for body.

## D.3 Spacing & Layout

- **Frame:** 1920x1080
- **Safe zone padding:** 120px all sides (extremely generous)
- **Content area:** 1680 x 840
- **Card padding:** 48px inner (very generous)
- **Card gap:** 32px
- **Card corner radius:** 20px
- **Section heading margin-bottom:** 56px

**Rules:**
- One concept per frame. If a scene has a table AND bullet points, split it into two scenes.
- Center alignment is the default (unlike other directions). Content sits in the middle of the frame.
- Massive negative space. At least 30% of the frame should be empty at all times.
- When showing a chart, the chart takes up at most 60% of the frame. Rest is whitespace and the heading.

## D.4 Cards & Surfaces

- Cards: bg #1C1C1E, no border, 20px radius, no shadow.
- Highlighted card: bg shifts to #2C2C2E. That's it. No glow, no border, just a background change.
- Dimmed card: opacity 0.35.
- Cards are used sparingly. In many templates (big_number, section_header, quote_highlight), there's no card at all; the text floats directly on the black background.

## D.5 Tables

- Minimal table styling. No header background color. Header text is just smaller + secondary color.
- Header: text #8E8E93, Inter 18px 600, uppercase, letter-spacing 2px. No background fill.
- Body rows: no alternating colors. All on bg-primary (#000000) or bg-surface (#1C1C1E).
- Row dividers: 1px #2C2C2E. Extremely subtle.
- Highlighted row: text turns pure white and font-weight increases to 600. No background color change.
- Best row: text accent-primary (blue) + bold.
- Cell padding: 20px vertical, 32px horizontal (spacious).
- Maximum 4 columns. If the paper's table has more, the planner must select the most important ones.

## D.6 Charts

- Axis lines: 1px #2C2C2E. Or no axis lines at all (just gridlines).
- Gridlines: 1px #1C1C1E. Extremely subtle.
- Axis labels: 16px Inter 400, color #8E8E93.
- Data labels: 24px SF Mono / JetBrains Mono 600, color #FFFFFF. Large and bold.
- Bars: 64px wide (thick), 12px top radius (very rounded). Fill #2C2C2E for baseline, accent-primary for highlighted. Only 2 colors max.
- Lines: 3px stroke, round. Dots: 10px diameter, solid fill. Large and visible.
- Legend: minimal. Below the chart, centered. 16px Inter.
- Maximum 5 bars or 3 lines per chart. Fewer data points, bigger impact.
- Donut: 220px outer, 140px inner. Big, centered, dominant. 6px segment gap.
- Heatmap: 6px gap, 12px radius. Rounded, soft.

## D.7 Animation Principles

- Easing: ease-out with very smooth deceleration. Apple's signature curve.
- Duration: 0.8-1.2s. Slower than other directions. Deliberate. Every animation has weight.
- Stagger: 0.2-0.4s. Unhurried.
- Entrance: fade only. No sliding. Elements materialize from 0 opacity to 1, nothing moves. Spatial stability.
- Exception: big_number value can scale from 0.9 to 1.0 (very slight) during fade.
- Bars grow from baseline slowly (0.8s each).
- Lines draw slowly, left-to-right, 2s total.
- Total animation budget: first 30-40% of scene. Apple lets things breathe.
- No decorative animations ever. No ambient glows, no pulsing, no particle effects.

## D.8 Figma Make Prompt

```
Design a video frame template at 1920x1080 pixels. Style: Apple keynote 
presentation. Pure black background #000000. White text #FFFFFF. One iOS blue 
accent #0A84FF used sparingly. No borders, no shadows, no gradients, no 
decoration. Extreme negative space, at least 30% of the frame empty. 
Typography: Inter at very large sizes (72px titles, 28px body). One concept 
per frame. This should look like a billboard: if you can't read it in 2 seconds, 
there's too much on screen. Maximum restraint. Every element must justify 
its existence.
```

---
---

# Cross-Direction Design Rules (Apply to All)

These rules apply regardless of which visual direction you choose.

## Frame Constraints
- Always 1920x1080. No exceptions.
- Content never bleeds to the edge. Minimum 64px padding on all sides.
- Design for viewing at arm's length on a laptop or phone screen. If you squint and can't read it, the text is too small.

## Data Density Per Scene
- Tables: maximum 6 columns, 8 rows. If the paper has a bigger table, the planner selects the most relevant subset.
- Charts: maximum 8 bars, 5 lines, or 8 scatter points per group. Simplify the paper's data for visual clarity.
- Bullet points: maximum 5 items. 3-4 is ideal.
- One concept per scene. Never combine a chart and a bullet list in the same frame.

## Chart Design Universals
- Y-axis always starts at 0 for bar charts (no truncated axes that exaggerate differences).
- Axis labels are mandatory. Never show a chart without labeled axes.
- Source citation at the bottom-right of every chart scene ("Table 2, Author et al. 2024").
- Highlighted/featured data (the paper's proposed method) always uses the accent-primary color. Baselines use the secondary/muted color. Viewer should instantly see "which one is theirs."
- Data labels directly on/above bars and at line endpoints. Don't rely on the viewer reading the axis scale.

## Table Design Universals
- Header row is always visually distinct from body rows.
- Numeric columns are always right-aligned, monospace font.
- Text columns are always left-aligned.
- First column (usually model/method names) is left-aligned and acts as the row label.
- The paper's proposed method row should be visually distinct (bold, accent color, or star marker).

## Animation Universals
- Every scene has two phases: animation phase (elements enter) and hold phase (everything visible, viewer reads while listening to narration).
- Hold phase is always longer than animation phase. Minimum 60% hold.
- Elements always enter, never exit. Once something is on screen, it stays until the scene transitions.
- Scene transitions are simple crossfades (0.5s). No wipes, no slides, no fancy transitions.

## Color Usage for Data
- Maximum 5 distinct colors in any single chart.
- Color should encode meaning consistently across the video: if "Transformer" is cyan in scene 3, it should be cyan in scene 7 too.
- Colorblind consideration: never differentiate data solely by red vs. green. Always combine color with another differentiator (pattern, label, position).

## What NOT to Include
- No logos or branding watermarks (unless the user adds one later).
- No decorative icons or illustrations.
- No stock photo backgrounds.
- No 3D effects or perspective transforms.
- No text smaller than 14px.
- No more than 40 words of body text on a single frame.