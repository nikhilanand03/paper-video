"""Stage 2: Generate a scene plan from extracted paper content via Azure OpenAI.

Two modes:
  - brief:    Single LLM call with full paper context → shorter, punchier video.
  - detailed: Per-section parallel LLM calls → longer, comprehensive video.
"""

from __future__ import annotations

import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from openai import AzureOpenAI
from pydantic import BaseModel, field_validator

from pipeline import config
from pipeline.template_registry import TEMPLATE_NAMES, get_template

logger = logging.getLogger(__name__)


# ── Pydantic models ──────────────────────────────────────────────────────────

class Scene(BaseModel):
    scene_number: int
    template: str
    data: dict[str, Any]
    narration: str
    duration_seconds: int | None = 8

    @field_validator("duration_seconds", mode="before")
    @classmethod
    def coerce_duration(cls, v: Any) -> int:
        if v is None or v == "":
            return 8
        try:
            return int(v)
        except (ValueError, TypeError):
            return 8

    @field_validator("template")
    @classmethod
    def check_template(cls, v: str) -> str:
        if v not in TEMPLATE_NAMES:
            raise ValueError(f"Unknown template '{v}'. Valid: {TEMPLATE_NAMES}")
        return v


class ScenePlan(BaseModel):
    scenes: list[Scene]


# ── Prompt templates ─────────────────────────────────────────────────────────

SYSTEM_PROMPT = (Path(__file__).parent.parent / "prompts" / "planner_system.txt").read_text()

FULL_PAPER_USER_TEMPLATE = """\
# Paper: {title}
Authors: {authors}

## Abstract
{abstract}

## Full Paper Content
{all_sections}

{figures_block}
{tables_block}

Plan the COMPLETE video from title_card through closing_card in a single pass.
Number scenes sequentially starting at 1.
Return valid JSON with the scenes array."""

SECTION_USER_TEMPLATE = """\
# Paper: {title}
Authors: {authors}

## Paper outline
{paper_outline}

You are planning scenes for the **{part_label}** part of a video presentation.
This is part {part_number} of {total_parts}.

{context_note}

## Content for this section
{section_content}

{figures_block}
{tables_block}

Plan scenes for ONLY the content above. Be thorough — cover every key point, figure, and table.
Scene numbers should start at 1.
Return valid JSON with the scenes array."""

REFINE_USER_TEMPLATE = """\
Below is a draft scene plan for a video presentation of the paper "{title}".
It was generated section-by-section, so there may be redundancy, repetition, or flow issues.

Review the entire plan and return an IMPROVED version that:
1. Removes redundant or repetitive scenes (if two scenes cover the same point, merge or cut one)
2. Ensures smooth narrative flow — each scene should build on the previous one
3. Keeps the title_card as scene 1 and closing_card as the last scene
4. Fixes any awkward transitions between sections
5. Preserves all important content — don't drop key findings, figures, or tables
6. Strongly prefer keeping data_table and image_with_caption scenes — tables and figures contain unique quantitative results that viewers expect to see. Only remove one if it is truly redundant with another table/figure already in the plan.
6. Keeps narrations conversational and non-repetitive across the whole video

Return the full improved plan as valid JSON with the scenes array.
Do NOT add markdown fences.

## Current draft plan ({scene_count} scenes):
{draft_json}"""

TITLE_USER_TEMPLATE = """\
# Paper: {title}
Authors: {authors}

Plan a single opening title_card scene for this paper.
Abstract: {abstract}

Scene number should be 1.
Return valid JSON with the scenes array."""


# ── Section grouping ─────────────────────────────────────────────────────────

_PART_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("abstract",      re.compile(r"(?i)^abstract$")),
    ("introduction",  re.compile(r"(?i)^\d*\.?\s*introduction")),
    ("related_work",  re.compile(r"(?i)^\d*\.?\s*(?:related\s+work|background|literature|prior\s+work)")),
    ("methodology",   re.compile(r"(?i)^\d*\.?\s*(?:method|approach|model|framework|architecture|preliminar|proposed|system|design|formulation|technique)")),
    ("experiments",   re.compile(r"(?i)^\d*\.?\s*(?:experiment|evaluation|setup|setting|dataset|implementation|training)")),
    ("results",       re.compile(r"(?i)^\d*\.?\s*(?:result|analysis|finding|performance|ablation|discussion|comparison)")),
    ("conclusion",    re.compile(r"(?i)^\d*\.?\s*(?:conclusion|summary|future\s+work|limitation)")),
]


def _classify_section(heading: str) -> str:
    """Classify a section heading into a logical part name."""
    for part_name, pattern in _PART_PATTERNS:
        if pattern.match(heading.strip()):
            return part_name
    return ""


def _group_sections_into_parts(sections: list[dict]) -> list[dict]:
    """Group consecutive sections into logical presentation parts."""
    parts: list[dict] = []
    current_part: str = ""
    current_label: str = ""
    current_sections: list[dict] = []

    def _flush():
        nonlocal current_sections
        if current_sections:
            all_fig_refs = sorted(set(
                r for s in current_sections for r in s.get("fig_refs", [])
            ))
            all_table_refs = sorted(set(
                r for s in current_sections for r in s.get("table_refs", [])
            ))
            parts.append({
                "slug": current_part or f"part_{len(parts)+1}",
                "label": current_label or f"Part {len(parts)+1}",
                "sections": list(current_sections),
                "fig_refs": all_fig_refs,
                "table_refs": all_table_refs,
            })
            current_sections = []

    for section in sections:
        heading = section.get("heading", "")
        classified = _classify_section(heading)

        if classified and classified != current_part:
            _flush()
            current_part = classified
            current_label = classified.replace("_", " ").title()
        elif not classified and current_part:
            pass
        elif not classified and not current_part:
            if not current_sections:
                current_part = f"section_{len(parts)+1}"
                current_label = heading

        current_sections.append(section)

    _flush()
    return parts


# ── Public API ───────────────────────────────────────────────────────────────

def plan_scenes(
    paper: dict,
    output_dir: str | Path | None = None,
    mode: str = "brief",
) -> ScenePlan:
    """Plan video scenes.

    Args:
        paper: Extraction dict from stage1.
        output_dir: Job output directory.
        mode: "brief" (single LLM call) or "detailed" (per-section parallel calls).

    Returns a ScenePlan.
    """
    import time as _time

    client = AzureOpenAI(
        azure_endpoint=config.get("azure_openai_endpoint"),
        api_key=config.get("azure_openai_api_key"),
        api_version="2025-01-01-preview",
    )
    deployment = config.get("azure_openai_planner_deployment")

    # Build image map for resolving figure keys
    image_map: dict[str, str] = {}
    fig_by_num: dict[int, dict] = {}
    for i, fig in enumerate(paper.get("figures", [])):
        key = f"fig_{i}"
        if fig.get("path"):
            image_map[key] = fig["path"]
        fig_by_num[fig.get("figure_number", i + 1)] = {**fig, "_key": key}

    table_by_num: dict[int, dict] = {}
    for i, tbl in enumerate(paper.get("tables", [])):
        table_by_num[tbl.get("table_number", i + 1)] = {**tbl, "_index": i}

    # Setup output dir
    planned_dir = None
    if output_dir:
        planned_dir = Path(output_dir) / "planned_outputs"
        planned_dir.mkdir(parents=True, exist_ok=True)

    if mode == "detailed":
        all_scenes = _plan_detailed(
            client, deployment, paper, fig_by_num, table_by_num, image_map, planned_dir
        )
    else:
        all_scenes = _plan_brief(
            client, deployment, paper, fig_by_num, table_by_num, image_map
        )

    # Renumber scenes sequentially
    for i, scene in enumerate(all_scenes):
        scene.scene_number = i + 1

    logger.info("Planned %d total scenes (mode=%s)", len(all_scenes), mode)
    plan = ScenePlan(scenes=all_scenes)

    if planned_dir:
        (planned_dir / "full_plan.json").write_text(
            json.dumps(plan.model_dump(), indent=2, default=str)
        )

    return plan


# ── Brief mode (single call) ────────────────────────────────────────────────

def _plan_brief(
    client, deployment, paper, fig_by_num, table_by_num, image_map,
) -> list[Scene]:
    """Plan all scenes in a single LLM call."""
    import time as _time

    all_section_parts = []
    for sec in paper.get("sections", []):
        heading = sec.get("heading", "")
        body = sec.get("body", "")[:2000]
        refs = _build_refs(sec, fig_by_num, table_by_num)
        ref_line = f"\n[References: {', '.join(refs)}]" if refs else ""
        all_section_parts.append(f"### {heading}{ref_line}\n{body}")

    figures_block = _build_figures_block(paper.get("figures", []))
    tables_block = _build_tables_block(paper.get("tables", []))

    prompt = FULL_PAPER_USER_TEMPLATE.format(
        title=paper.get("title", "Untitled"),
        authors=", ".join(paper.get("authors", [])),
        abstract=paper.get("abstract", "")[:800],
        all_sections="\n\n".join(all_section_parts),
        figures_block=figures_block,
        tables_block=tables_block,
    )

    logger.info("Planning (brief) — single LLM call (%d sections, %d figs, %d tables)",
                len(paper.get("sections", [])), len(paper.get("figures", [])), len(paper.get("tables", [])))
    _t0 = _time.monotonic()
    scenes = _call_llm(client, deployment, prompt, image_map)
    logger.info("  ↳ LLM call took %.1fs, returned %d scenes", _time.monotonic() - _t0, len(scenes))
    return scenes


# ── Detailed mode (per-section parallel calls) ──────────────────────────────

def _plan_detailed(
    client, deployment, paper, fig_by_num, table_by_num, image_map, planned_dir,
) -> list[Scene]:
    """Plan scenes per-section in parallel for comprehensive coverage."""
    import time as _time

    parts = _group_sections_into_parts(paper.get("sections", []))
    paper_outline = "\n".join(f"  {i+1}. {p['label']}" for i, p in enumerate(parts))

    logger.info("Planning (detailed) — %d parts + title via %d parallel LLM calls",
                len(parts), len(parts) + 1)
    _t0 = _time.monotonic()

    all_scenes: list[Scene] = []

    with ThreadPoolExecutor(max_workers=len(parts) + 1) as pool:
        title_future = pool.submit(
            _plan_title, client, deployment, paper, image_map
        )
        part_futures = [
            pool.submit(
                _plan_part, client, deployment, paper, part,
                part_idx + 1, len(parts),
                fig_by_num, table_by_num, image_map, paper_outline,
            )
            for part_idx, part in enumerate(parts)
        ]

        title_scenes = title_future.result()
        all_scenes.extend(title_scenes)
        if planned_dir:
            _save_part(planned_dir, "00_title", title_scenes)

        for part_idx, fut in enumerate(part_futures):
            part_scenes = fut.result()
            all_scenes.extend(part_scenes)
            if planned_dir:
                slug = f"{part_idx + 1:02d}_{parts[part_idx]['slug']}"
                _save_part(planned_dir, slug, part_scenes)

    logger.info("  ↳ Parallel calls took %.1fs, returned %d scenes", _time.monotonic() - _t0, len(all_scenes))

    # Save pre-refinement plan
    if planned_dir:
        pre_refine = {"scenes": [s.model_dump() for s in all_scenes]}
        (planned_dir / "pre_refine.json").write_text(json.dumps(pre_refine, indent=2, default=str))

    # Refinement pass — single call to review the full plan for coherence
    logger.info("  Refining plan for coherence and flow...")
    _t1 = _time.monotonic()

    draft_json = json.dumps(
        {"scenes": [s.model_dump() for s in all_scenes]},
        indent=2, default=str,
    )
    refine_prompt = REFINE_USER_TEMPLATE.format(
        title=paper.get("title", "Untitled"),
        scene_count=len(all_scenes),
        draft_json=draft_json,
    )

    try:
        refined_scenes = _call_llm(client, deployment, refine_prompt, image_map)
        logger.info("  ↳ Refinement took %.1fs, %d → %d scenes",
                    _time.monotonic() - _t1, len(all_scenes), len(refined_scenes))
        # Reinsert any tables/figures the LLM dropped
        final_scenes = _reinsert_dropped_scenes(all_scenes, refined_scenes)
        if len(final_scenes) != len(refined_scenes):
            logger.info("  ↳ Reinserted %d dropped data_table/image scenes → %d total",
                        len(final_scenes) - len(refined_scenes), len(final_scenes))
        return final_scenes
    except Exception as e:
        logger.warning("  ↳ Refinement failed (%s), using unrefined plan", e)
        return all_scenes


def _reinsert_dropped_scenes(
    original: list[Scene], refined: list[Scene],
) -> list[Scene]:
    """Reinsert data_table and image_with_caption scenes that the refiner dropped.

    Finds tables/images in the original that have no match in the refined plan
    (by comparing template + a content fingerprint), then inserts them back
    in a sensible position — right after the nearest section_header that
    preceded them in the original plan.
    """
    PROTECTED = {"data_table", "image_with_caption"}

    def _fingerprint(scene: Scene) -> str:
        """Create a rough fingerprint to match scenes across plans."""
        if scene.template == "data_table":
            cols = scene.data.get("columns", [])
            return f"data_table:{','.join(str(c) for c in cols[:4])}"
        elif scene.template == "image_with_caption":
            return f"image:{scene.data.get('image_path', scene.data.get('imageSrc', '?'))}"
        return ""

    # Fingerprints present in refined plan
    refined_fps = {_fingerprint(s) for s in refined if s.template in PROTECTED}

    # Find dropped scenes (skip image scenes with non-file paths like "table_0")
    dropped: list[tuple[int, Scene]] = []  # (original_index, scene)
    for i, s in enumerate(original):
        if s.template in PROTECTED:
            # Skip image scenes that reference table keys instead of real image files
            if s.template == "image_with_caption":
                img_path = s.data.get("image_path", s.data.get("imageSrc", ""))
                if not img_path or not Path(str(img_path)).is_file():
                    continue
            fp = _fingerprint(s)
            if fp and fp not in refined_fps:
                dropped.append((i, s))

    if not dropped:
        return refined

    # Build a map: for each dropped scene, find which section_header it followed
    # in the original plan, then find that header (by narration match) in refined.
    result = list(refined)

    for orig_idx, dropped_scene in reversed(dropped):
        # Find the section_header that preceded this scene in the original
        preceding_header_narration = None
        for j in range(orig_idx - 1, -1, -1):
            if original[j].template == "section_header":
                preceding_header_narration = original[j].narration
                break

        # Find that header in the refined plan
        insert_pos = len(result) - 1  # default: before closing_card
        if preceding_header_narration:
            for k, rs in enumerate(result):
                if rs.template == "section_header" and rs.narration == preceding_header_narration:
                    # Insert after the last scene in this section (before next header or end)
                    insert_pos = k + 1
                    while insert_pos < len(result) and result[insert_pos].template not in ("section_header", "closing_card"):
                        insert_pos += 1
                    break

        # Don't insert after closing_card
        if insert_pos < len(result) and result[insert_pos].template == "closing_card":
            pass  # insert right before it
        result.insert(insert_pos, dropped_scene)

    return result


def _plan_title(client, deployment, paper, image_map) -> list[Scene]:
    prompt = TITLE_USER_TEMPLATE.format(
        title=paper.get("title", "Untitled"),
        authors=", ".join(paper.get("authors", [])),
        abstract=paper.get("abstract", "")[:500],
    )
    return _call_llm(client, deployment, prompt, image_map)


def _plan_part(
    client, deployment, paper, part,
    part_number, total_parts,
    fig_by_num, table_by_num, image_map, paper_outline,
) -> list[Scene]:
    content_parts = []
    for sec in part["sections"]:
        heading = sec.get("heading", "")
        body = sec.get("body", "")[:2000]
        refs = _build_refs(sec, fig_by_num, table_by_num)
        ref_line = f"\n[References: {', '.join(refs)}]" if refs else ""
        content_parts.append(f"### {heading}{ref_line}\n{body}")

    section_content = "\n\n".join(content_parts)
    figures_block = _build_figures_block_for_part(part, fig_by_num)
    tables_block = _build_tables_block_for_part(part, table_by_num)

    if part_number == 1:
        context_note = "This is the opening section. Start with a section_header."
    elif part_number == total_parts:
        context_note = "This is the FINAL section. End with a closing_card as the last scene."
    else:
        context_note = ""

    prompt = SECTION_USER_TEMPLATE.format(
        title=paper.get("title", "Untitled"),
        authors=", ".join(paper.get("authors", [])),
        paper_outline=paper_outline,
        part_label=part["label"],
        part_number=part_number,
        total_parts=total_parts,
        context_note=context_note,
        section_content=section_content,
        figures_block=figures_block,
        tables_block=tables_block,
    )

    return _call_llm(client, deployment, prompt, image_map)


def _save_part(planned_dir: Path, slug: str, scenes: list[Scene]) -> None:
    data = {"scenes": [s.model_dump() for s in scenes]}
    (planned_dir / f"{slug}.json").write_text(json.dumps(data, indent=2, default=str))


# ── Shared helpers ───────────────────────────────────────────────────────────

def _build_refs(sec, fig_by_num, table_by_num) -> list[str]:
    refs = []
    for fn in sec.get("fig_refs", []):
        fig = fig_by_num.get(fn)
        if fig:
            refs.append(f'{fig["_key"]} (Figure {fn})')
    for tn in sec.get("table_refs", []):
        tbl = table_by_num.get(tn)
        if tbl:
            refs.append(f'table_{tbl["_index"]} (Table {tn})')
    return refs


def _build_figures_block(figures: list[dict]) -> str:
    lines = []
    for i, fig in enumerate(figures):
        key = f"fig_{i}"
        fig_num = fig.get("figure_number", i + 1)
        caption = fig.get("caption", "")
        desc = fig.get("description", "")
        lines.append(f'- {key}: Figure {fig_num} — "{caption or desc}" (use image_path="{key}")')
    return "## Available Figures\n" + "\n".join(lines) if lines else ""


def _build_tables_block(tables: list[dict]) -> str:
    lines = []
    for i, tbl in enumerate(tables):
        tbl_num = tbl.get("table_number", i + 1)
        cols = tbl.get("columns", [])
        rows = tbl.get("rows", [])
        caption = tbl.get("caption", f"Table {tbl_num}")
        lines.append(f"### table_{i}: {caption}")
        lines.append(f"  Columns: {json.dumps(cols)}")
        for row in rows[:10]:
            lines.append(f"  Row: {json.dumps(row)}")
        if len(rows) > 10:
            lines.append(f"  ... ({len(rows)} rows total)")
    return "## Tables (each MUST get a `data_table` scene)\n" + "\n".join(lines) if lines else ""


def _build_figures_block_for_part(part, fig_by_num) -> str:
    lines = []
    for fn in part.get("fig_refs", []):
        fig = fig_by_num.get(fn)
        if fig:
            key = fig["_key"]
            caption = fig.get("caption", "")
            desc = fig.get("description", "")
            lines.append(f'- {key}: Figure {fn} — "{caption or desc}" (use image_path="{key}")')
    return "## Figures referenced\n" + "\n".join(lines) if lines else ""


def _build_tables_block_for_part(part, table_by_num) -> str:
    lines = []
    for tn in part.get("table_refs", []):
        tbl = table_by_num.get(tn)
        if tbl:
            idx = tbl["_index"]
            cols = tbl.get("columns", [])
            rows = tbl.get("rows", [])
            caption = tbl.get("caption", f"Table {tn}")
            lines.append(f"### table_{idx}: {caption}")
            lines.append(f"  Columns: {json.dumps(cols)}")
            for row in rows[:10]:
                lines.append(f"  Row: {json.dumps(row)}")
            if len(rows) > 10:
                lines.append(f"  ... ({len(rows)} rows total)")
    return "## Tables (each MUST get a `data_table` scene)\n" + "\n".join(lines) if lines else ""


# ── LLM call ────────────────────────────────────────────────────────────────

def _call_llm(
    client: AzureOpenAI,
    deployment: str,
    user_prompt: str,
    image_map: dict[str, str],
) -> list[Scene]:
    """Send a planning request to the LLM and parse the response."""
    resp = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=16384,
    )

    raw = resp.choices[0].message.content.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON: %s\nRaw (first 500 chars):\n%s", e, raw[:500])
        raise ValueError(f"LLM returned invalid JSON: {e}") from e
    # Ensure duration_seconds has a default for every scene (LLM often omits it)
    for scene_dict in data.get("scenes", []):
        if "duration_seconds" not in scene_dict or scene_dict["duration_seconds"] is None:
            scene_dict["duration_seconds"] = 8
    plan = ScenePlan.model_validate(data)

    # Post-validation: resolve image keys
    for scene in plan.scenes:
        get_template(scene.template)
        if "image_path" in scene.data:
            key = scene.data["image_path"]
            if key in image_map:
                scene.data["image_path"] = image_map[key]

    return plan.scenes
