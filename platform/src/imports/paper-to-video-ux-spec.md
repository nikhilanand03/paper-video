Paper-to-Video Platform: UI/UX Specification
Target Users
Primary: Graduate students (Masters and PhD) who need to understand papers quickly for seminars, literature reviews, or catching up on a new field.
Secondary: Professors and postdocs who want to create explainer content for their lab groups, courses, or conference prep.
Tertiary: Undergrads, industry researchers, and curious self-learners who encounter papers through Twitter/X, Hacker News, or Reddit and want a faster way in.
What they all share: They have a specific paper in mind right now. They are not browsing. They arrived with intent.

Core Design Principles

The landing page is the product. No marketing site, no feature grids, no testimonials wall. You land, you upload, you watch. The value proposition is demonstrated, not described.
First result without signup. The user gets one full video generation before being asked to create an account. Prove value first, capture the user second. Signup wall appears when they try to generate a second video or want to save/share.
Paper-native interactions. Researchers think in sections, figures, tables, and citations. The video viewer should map to these concepts, not generic video player concepts like "chapters."
Time-to-understanding is the metric. Everything in the UX should reduce the time between "I found a paper" and "I understand the key contributions."


Screen 1: Home / Upload
This is a single-screen experience. The user sees it and knows exactly what to do within 2 seconds.
Layout
Top bar (minimal):

Logo/wordmark (left)
"Sign In" link (right, text only, no prominent button)
Nothing else. No navigation menu. There's only one thing to do here.

Center of the page (dominant):

One-line headline: something like "Drop a paper. Get a video." or "Understand any paper in 3 minutes." Large, confident, no subtext needed.
The input area (the centerpiece of the entire page):

A large, inviting drop zone / input box. Roughly 600px wide, 200px tall.
Three input modes, seamlessly handled:

Drag and drop a PDF onto the zone (the default visual state shows a dashed border with "Drop a PDF here")
Click to browse files (the drop zone is also a file picker button)
Paste a URL (an input field below the drop zone, or integrated into it, accepts arXiv URLs like arxiv.org/abs/2401.12345 or DOIs like 10.1234/...)


The input area should feel like a search bar, not a form. One action, not multiple fields.


"Generate Video" button — appears/activates once a file is uploaded or URL is pasted. Large, primary accent color.

Below the input area:

A single example: "Try it with:" followed by 2-3 clickable famous paper titles ("Attention Is All You Need", "BERT", "AlphaFold 2"). Clicking one auto-fills the URL and starts generation. This serves as both a demo and social proof ("these are the kinds of papers it works on").
Small text: "PDF, arXiv URL, or DOI. Up to 50 pages. Takes about 2-3 minutes."

Below the fold (optional, scrollable):

A single sample video playing (muted, autoplaying, looped) showing what the output looks like. This is the only "marketing" content. One example, not a grid of features.
Maybe 3 short lines of how it works: "1. We read the paper. 2. AI extracts key findings, tables, and results. 3. You get a narrated video walkthrough." Icon + one sentence each. No more than this.

What's NOT on this page

No feature comparison tables
No pricing (yet)
No "How it works" hero section that takes 3 scrolls
No testimonials
No "Trusted by researchers at MIT, Stanford..." logos
No blog links, no footer navigation maze

Mobile layout

The drop zone becomes a simple "Upload PDF" button (drag and drop doesn't work on mobile) + URL input field stacked vertically.
Everything else stays the same, just narrower.


Screen 2: Processing / Generation
After the user uploads or submits a URL, they land here. This page keeps them engaged during the 2-3 minute generation time.
Layout
Top bar: Same minimal bar. Now includes a small "Back" or "New Video" link.
Left column (40% width): Paper info panel

Paper title (extracted immediately from PDF, shown within seconds of upload)
Authors
Abstract (if extractable)
This appears almost instantly, confirming "yes, we read your paper correctly." It builds trust while the heavier processing happens.

Right column (60% width): Progress panel

A vertical stepper showing the pipeline stages, each with a status:

○ Extracting content (reading PDF, pulling tables and figures)
○ Planning scenes (deciding what to show)
○ Generating visuals (creating slides and charts)
○ Adding narration (text-to-speech)
○ Assembling video (stitching everything together)


The current step has a spinner/loading animation. Completed steps show a checkmark. Upcoming steps are dimmed.
Estimated time remaining below the stepper: "About 2 minutes remaining"

Below the stepper: Scene plan preview (progressive reveal)

As soon as Stage 2 (scene planning) completes, the scene plan appears here as a list:

Scene 1: Title Card — "Attention Is All You Need"
Scene 2: Key Findings — 3 contributions
Scene 3: Table — Results comparison
Scene 4: Chart — BLEU scores
...etc


This gives the user something to read and builds anticipation. They can see the video's structure before it's rendered.
Each scene entry is a small card showing: scene number, template type icon (table icon, chart icon, bullet list icon), and a brief description.

What happens if they leave and come back:

The URL includes a job ID: /video/abc123
If they close the tab and return, they see the same progress page (or the finished video if it completed while they were away).
No account needed. The job ID in the URL is the session key.

Error states

PDF too long (>50 pages): "This paper is [X] pages. We currently support up to 50 pages. Want us to process the first 50?" with a confirm button.
PDF not readable (scanned image, no text layer): "We couldn't extract text from this PDF. It may be a scanned document. Try uploading a text-based PDF or paste the arXiv URL instead."
Generation fails: "Something went wrong while generating your video. We're looking into it. [Try again] or [Try a different paper]." Honest, no corporate-speak.


Screen 3: Video Viewer
This is the main experience. The user will spend 3-10 minutes here per paper. It needs to be better than just a YouTube embed.
Layout: Two-panel design
Left panel (65% width): Video player + scene navigation
The video plays here. Below the video is a scene-based timeline, not a standard scrubber bar.

Video player area — standard 16:9 video at the top. Play/pause, volume, fullscreen controls. Keyboard shortcuts: space to play/pause, left/right arrows to jump between scenes (not 5-second skip).
Scene timeline (below the video) — a horizontal row of scene thumbnails. Each thumbnail is a small snapshot of that scene (~160x90px). The currently playing scene is highlighted with an accent border. Clicking any thumbnail jumps to that scene.

Each thumbnail shows: a small scene type icon (table, chart, bullets), the scene number, and a 1-2 word label ("Results Table", "Key Findings").
This replaces the standard video progress bar. The user navigates by content, not by time.
A thin progress bar still exists above the thumbnails showing overall progress, but it's secondary.


Playback speed — a small control for 1x, 1.25x, 1.5x, 2x speed. Researchers often want to speed through familiar content.

Right panel (35% width): Paper context + annotations
This panel has tabs or a segmented control at the top with two views:
Tab 1: "Paper" (default)

Shows the extracted paper content, organized by section, synced to the video.
As the video plays, the corresponding section of the paper text highlights or scrolls into view.
This means: when Scene 3 (results table) is playing, the right panel scrolls to the paper's results section and highlights the relevant table.
The user can read the original text alongside the visual explanation. This is the killer feature for researchers who want depth: "the video gives me the overview, the paper panel gives me the details."
Tables from the paper appear inline in this panel as formatted HTML (not images of tables).
Figures from the paper appear inline (extracted images).
Equations render via KaTeX.

Tab 2: "Notes"

A timestamped annotation panel.
The user can click "Add note" (or hit a keyboard shortcut, e.g., "N") at any point during playback. This:

Pauses the video
Opens a small text input anchored to the current timestamp
The user types their note and hits Enter
The note appears in the Notes panel as a card: timestamp + note text


Clicking any note card in the panel jumps the video to that timestamp.
Notes are saved locally (localStorage) by default. If the user is signed in, notes sync to their account and persist across devices.
Notes can be exported as markdown: "## Notes on 'Attention Is All You Need'\n- [0:42] The scaling factor 1/sqrt(d_k) prevents softmax from entering regions with small gradients\n- [1:15] Table 2: Transformer base achieves comparable BLEU with 10x fewer FLOPs"

Panel collapse: The right panel can be collapsed (a toggle button at the panel edge) to give the video player full width. Useful when the user just wants to watch without reference material.
Below the video (full width):
Video metadata bar:

Paper title (linked to original paper URL/arXiv)
"Generated [date]" timestamp
Share button (copies a shareable URL)
Download button (downloads the MP4)
"Regenerate" button (re-runs the pipeline, useful if the user wants a different take)

Scene breakdown (optional expandable section):

A list view of all scenes with their narration text visible. Like a video transcript, but organized by scene instead of continuous text.
Each scene shows: thumbnail, scene number, template type, narration text, duration.
Clicking any scene scrolls the video to that point.
This is useful for researchers who prefer reading the narration over listening to it, or who want to skim the entire video's content quickly.


Screen 4: Library (requires sign-in)
Once a user creates an account, they get a personal library of all their generated videos.
Layout
Simple grid view:

Cards showing: paper title, thumbnail of the first scene, generation date, duration.
Sort by: recent (default), alphabetical, most viewed.
Search bar at the top (searches paper titles and authors).

Each card, on hover/click:

"Watch" — goes to the viewer
"Share" — copies shareable link
"Download" — downloads MP4
"Delete" — removes from library
"Notes" — shows annotation count (e.g., "3 notes")

Empty state (first visit):

"Your video library is empty. Generate your first video?" with a link back to the upload page.
Maybe show the same example papers as the home page.


Screen 5: Shared/Public Video
When someone shares a video link, the recipient sees a slightly different viewer.
Differences from the authenticated viewer:

No "Notes" tab (annotations are private to the creator, unless explicitly shared)
A banner at the top: "Generated with [Product Name] — Make your own from any paper" with a CTA to the home page
The video is fully viewable without sign-in
The right panel "Paper" tab still works (shows extracted sections synced to video)
If the recipient wants to add their own notes, they're prompted to create an account


Micro-interactions and Details
Keyboard shortcuts (displayed in a small "?" tooltip in the bottom-right)

Space — play/pause
Left/Right arrows — previous/next scene
N — add note at current timestamp
F — toggle fullscreen
1/2/3... — jump to scene 1, 2, 3...
+/- — speed up / slow down playback
P — toggle right panel open/closed
T — switch right panel tab (Paper / Notes)

URL structure

Home: /
Processing: /video/{job_id} (same URL becomes the viewer when done)
Library: /library
Shared video: /v/{short_id} (short, shareable URL)

Loading states

Skeleton screens for the viewer while the video loads (gray placeholder for video, pulsing placeholder cards for scene thumbnails).
The paper info panel loads first (text is fast), then the video streams in.

Responsive behavior

Desktop (>1200px): Two-panel layout as described.
Tablet (768-1200px): Right panel collapses by default. Accessible via a slide-out drawer triggered by a button.
Mobile (<768px): Single column. Video player at top, scene thumbnails scroll horizontally below, paper/notes panels are tabbed below that. Annotations via a floating "+" button in the bottom-right corner.


Authentication / Accounts
When to prompt sign-in:

First video: no sign-in required. Video is generated and viewable via URL.
Second video attempt: soft prompt. "Create a free account to save your videos and generate more." User can dismiss and still try (but the first video is now gone if they didn't bookmark the URL).
Third attempt: required sign-in.
Saving notes: soft prompt on first note. "Sign in to save your notes across sessions."

Sign-in methods:

Google (primary, one-click, most researchers use Google/Gmail)
Institutional SSO (stretch goal, huge value for university adoption)
Email + password (fallback)

Free tier (default):

5 videos per month
Notes and annotations
MP4 download
Shareable links

Paid tier (future):

Unlimited videos
Batch processing (upload 10 papers at once)
Custom branding (for professors creating course content)
Priority generation (faster queue)
API access (for integration with reading tools like Zotero, Mendeley)


Collaboration Features (Post-Launch)
These are stretch goals but worth designing for in the architecture:
Lab group sharing:

A user can create a "Lab" or "Group" and invite members via email.
Videos generated by any member are visible to the group.
Annotations can be marked as "shared with group" or "private."
Group members see each other's notes in the Notes tab, color-coded by author.

Discussion threads:

On the shared video, group members can reply to each other's annotations, creating threaded discussions anchored to specific timestamps.
"At [1:23], @alice: 'Isn't this just kernel attention?' → @bob: 'No, the scaling factor changes the gradient flow...'"

Reading lists:

A professor creates a reading list of 10 papers for a seminar.
Students get video summaries of all 10, can annotate, and the professor sees which papers generated the most questions (annotation density as engagement signal).


Content Model
How the system organizes data:
User
 └── Library
      └── Video
           ├── paper_metadata (title, authors, venue, year, URL)
           ├── scene_plan (JSON: template + data + narration per scene)
           ├── video_file (MP4 URL)
           ├── scenes[] (thumbnail, start_time, end_time, template_type)
           ├── paper_sections[] (extracted text, synced to scenes)
           └── annotations[] (user_id, timestamp, text, is_shared)

What This Does NOT Include (Intentionally)

AI chat about the paper. Tempting, but out of scope. The video IS the explanation. If people want to ask follow-up questions, that's a different product (or a future feature).
Paper recommendations. "If you liked this paper, try..." is not the product. The user brings their own paper.
Social features (likes, comments, public profiles). This is a productivity tool, not a social network. Keep it focused.
Editing the generated video. The user cannot rearrange scenes, change narration text, or swap templates. Regeneration is the editing mechanism. A "guided regeneration" where the user can give feedback ("focus more on the methodology," "skip the related work") is a future feature.
Real-time generation preview. Showing the video frame-by-frame as it renders is technically possible but adds enormous complexity. The progress stepper is sufficient.




Appendix: Video Template Brand Guidelines — Light Editorial
Feels like a beautifully typeset Nature article or a Stripe blog post rendered as a video. Clean, authoritative, readable. Stands out because almost all tech/science video content uses dark themes.

Color Palette
TokenHexUsagebg-primary#FAFAF8Main background. Warm off-white, not sterile pure white.bg-surface#FFFFFFCard and table surfaces. True white lifts them off the warm background.bg-code#F4F4F0Code snippets, monospace blocks, equation backgrounds.text-primary#1A1A1AHeadlines and body text. Near-black for maximum readability.text-secondary#6B7280Captions, labels, axis labels, source citations.text-dim#9CA3AFTertiary info, decorative numbers, watermarks.accent-primary#2563EBPrimary accent. Confident blue. Used for highlights, chart emphasis, active states.accent-secondary#7C3AEDPurple. Used for secondary data series, alternate emphasis.accent-positive#059669Green. "Our method wins" indicators, positive deltas, upward trends.accent-negative#DC2626Red. Baseline/previous work in charts, negative deltas, downward trends.accent-amber#D97706Amber. Warnings, notable callouts, third data series.border#E5E7EBCard borders, table gridlines, dividers. Subtle, not heavy.border-accentrgba(37, 99, 235, 0.2)Blue-tinted border for highlighted cards, active elements.
Rules:

Background is always warm off-white (#FAFAF8), never pure white (#FFFFFF) for the scene background.
Maximum 2 accent colors per scene. If a chart has 5 series, use 2 accents + 3 grays.
Highlighted/winning data always uses accent-primary (blue). Previous work uses text-secondary (gray).

Typography
RoleFontWeightSizeTrackingTitleInstrument Serif40060px-1pxHeadingInter60038px-0.5pxBodyInter40024px0CaptionInter40016px0.2pxNumbers/DataIBM Plex Mono50022px0EquationKaTeX default (Latin Modern)—32px—
Rules:

Instrument Serif is ONLY for the title_card template (paper title). All other headings use Inter.
Numbers in tables and charts always use IBM Plex Mono for alignment and legibility.
Maximum 3 font sizes per scene. If you need more hierarchy, use weight and color, not more sizes.
Line height: 1.2 for headings, 1.6 for body, 1.0 for data/numbers.

Spacing & Layout

Frame: 1920x1080
Safe zone padding: 96px top/bottom, 128px left/right
Content area: 1664 x 888
Grid: 12 columns, 24px gutter
Card padding: 32px inner
Card gap: 24px between cards
Card corner radius: 12px
Section heading margin-bottom: 40px

Rules:

Content is left-aligned by default. Center alignment only for title_card and big_number templates.
Tables and charts stretch to full content width. Never float them in the middle with dead space on both sides.
Vertical rhythm: every element snaps to an 8px grid.