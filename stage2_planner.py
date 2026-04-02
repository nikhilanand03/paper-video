"""Stage 2: Generate a scene plan from extracted paper content via Azure OpenAI.

Plans each paper section independently with its own LLM call, then combines
them into a single ScenePlan.  Each section's planned scenes are saved as
separate JSON files in a `planned_outputs/` directory for inspection.
"""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from openai import AzureOpenAI
from pydantic import BaseModel, field_validator

import config
from template_registry import TEMPLATE_NAMES, get_template


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

SYSTEM_PROMPT = (Path(__file__).parent / "prompts" / "planner_system.txt").read_text()

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

Plan scenes for ONLY the content above. Scene numbers should start at 1.
Return valid JSON with the scenes array."""

TITLE_USER_TEMPLATE = """\
# Paper: {title}
Authors: {authors}

Plan a single opening title_card scene for this paper.
Abstract: {abstract}

Scene number should be 1.
Return valid JSON with the scenes array."""


# ── Section grouping ─────────────────────────────────────────────────────────

# Patterns to assign sections to logical parts
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
    """Group consecutive sections into logical presentation parts.

    Returns a list of dicts:
        {label, slug, sections: [list of section dicts], fig_refs, table_refs}
    """
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
            # New logical part
            _flush()
            current_part = classified
            current_label = classified.replace("_", " ").title()
        elif not classified and current_part:
            # Continuation of current part (sub-section)
            pass
        elif not classified and not current_part:
            # Unclassified section at start — give it a generic label
            if not current_sections:
                current_part = f"section_{len(parts)+1}"
                current_label = heading

        current_sections.append(section)

    _flush()
    return parts


# ── Public API ───────────────────────────────────────────────────────────────

def plan_scenes(paper: dict, output_dir: str | Path | None = None) -> ScenePlan:
    """Plan video scenes section-by-section. Saves per-part JSONs to planned_outputs/.

    Args:
        paper: Extraction dict from stage1 (title, authors, abstract, sections, tables, figures).
        output_dir: Job output directory. If given, saves planned_outputs/ there.

    Returns a combined ScenePlan.
    """
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

    # Group sections into logical parts
    parts = _group_sections_into_parts(paper.get("sections", []))

    # Setup output dir
    planned_dir = None
    if output_dir:
        planned_dir = Path(output_dir) / "planned_outputs"
        planned_dir.mkdir(parents=True, exist_ok=True)

    # Build paper outline so each parallel call knows the full structure
    paper_outline = "\n".join(
        f"  {i+1}. {p['label']}" for i, p in enumerate(parts)
    )

    all_scenes: list[Scene] = []

    # Plan title + all parts in parallel
    with ThreadPoolExecutor(max_workers=len(parts) + 1) as pool:
        title_future = pool.submit(
            _plan_title, client, deployment, paper, 1
        )
        part_futures = [
            pool.submit(
                _plan_part, client, deployment, paper, part,
                part_idx + 1, len(parts),
                fig_by_num, table_by_num, image_map, 1, paper_outline,
            )
            for part_idx, part in enumerate(parts)
        ]

        # Collect title first
        title_scenes = title_future.result()
        all_scenes.extend(title_scenes)
        if planned_dir:
            _save_part(planned_dir, "00_title", title_scenes)

        # Collect parts in order
        for part_idx, fut in enumerate(part_futures):
            part_scenes = fut.result()
            all_scenes.extend(part_scenes)
            if planned_dir:
                slug = f"{part_idx + 1:02d}_{parts[part_idx]['slug']}"
                _save_part(planned_dir, slug, part_scenes)

    # Renumber scenes sequentially
    for i, scene in enumerate(all_scenes):
        scene.scene_number = i + 1

    plan = ScenePlan(scenes=all_scenes)

    # Save combined plan
    if planned_dir:
        (planned_dir / "full_plan.json").write_text(
            json.dumps(plan.model_dump(), indent=2, default=str)
        )

    return plan


# ── Internal helpers ─────────────────────────────────────────────────────────

def _plan_title(
    client: AzureOpenAI, deployment: str, paper: dict, scene_start: int
) -> list[Scene]:
    """Plan the title card scene."""
    prompt = TITLE_USER_TEMPLATE.format(
        title=paper.get("title", "Untitled"),
        authors=", ".join(paper.get("authors", [])),
        abstract=paper.get("abstract", "")[:500],
    )
    return _call_llm(client, deployment, prompt, {}, scene_start)


def _plan_part(
    client: AzureOpenAI,
    deployment: str,
    paper: dict,
    part: dict,
    part_number: int,
    total_parts: int,
    fig_by_num: dict[int, dict],
    table_by_num: dict[int, dict],
    image_map: dict[str, str],
    scene_start: int,
    paper_outline: str = "",
) -> list[Scene]:
    """Plan scenes for one logical part of the paper."""

    # Build section content
    content_parts = []
    for sec in part["sections"]:
        heading = sec.get("heading", "")
        body = sec.get("body", "")[:2000]
        refs = []
        for fn in sec.get("fig_refs", []):
            fig = fig_by_num.get(fn)
            if fig:
                refs.append(f'{fig["_key"]} (Figure {fn})')
        for tn in sec.get("table_refs", []):
            tbl = table_by_num.get(tn)
            if tbl:
                refs.append(f'table_{tbl["_index"]} (Table {tn})')
        ref_line = f"\n[References: {', '.join(refs)}]" if refs else ""
        content_parts.append(f"### {heading}{ref_line}\n{body}")

    section_content = "\n\n".join(content_parts)

    # Build figures block for referenced figures
    figures_lines = []
    for fn in part.get("fig_refs", []):
        fig = fig_by_num.get(fn)
        if fig:
            key = fig["_key"]
            caption = fig.get("caption", "")
            desc = fig.get("description", "")
            figures_lines.append(
                f'- {key}: Figure {fn} — "{caption or desc}" (use image_path="{key}")'
            )
    figures_block = "## Figures referenced\n" + "\n".join(figures_lines) if figures_lines else ""

    # Build tables block for referenced tables
    tables_lines = []
    for tn in part.get("table_refs", []):
        tbl = table_by_num.get(tn)
        if tbl:
            idx = tbl["_index"]
            cols = tbl.get("columns", [])
            rows = tbl.get("rows", [])
            caption = tbl.get("caption", f"Table {tn}")
            tables_lines.append(f"### table_{idx}: {caption}")
            tables_lines.append(f"  Columns: {json.dumps(cols)}")
            for row in rows[:10]:
                tables_lines.append(f"  Row: {json.dumps(row)}")
            if len(rows) > 10:
                tables_lines.append(f"  ... ({len(rows)} rows total)")
    tables_block = (
        "## Tables (each MUST get a `data_table` scene)\n" + "\n".join(tables_lines)
        if tables_lines else ""
    )

    # Context note based on part position
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

    scenes = _call_llm(client, deployment, prompt, image_map, scene_start)
    return scenes


def _call_llm(
    client: AzureOpenAI,
    deployment: str,
    user_prompt: str,
    image_map: dict[str, str],
    scene_start: int,
) -> list[Scene]:
    """Send a planning request to the LLM and parse the response."""
    resp = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=8192,
    )

    raw = resp.choices[0].message.content.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]

    data = json.loads(raw)
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


def _save_part(planned_dir: Path, slug: str, scenes: list[Scene]) -> None:
    """Save a part's scenes as a JSON file."""
    data = {
        "scenes": [s.model_dump() for s in scenes],
    }
    (planned_dir / f"{slug}.json").write_text(
        json.dumps(data, indent=2, default=str)
    )
