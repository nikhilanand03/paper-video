"""Stage 2: Generate a scene plan from extracted paper content via Azure OpenAI."""

from __future__ import annotations

import json
import re
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
    duration_seconds: int

    @field_validator("template")
    @classmethod
    def check_template(cls, v: str) -> str:
        if v not in TEMPLATE_NAMES:
            raise ValueError(f"Unknown template '{v}'. Valid: {TEMPLATE_NAMES}")
        return v


class ScenePlan(BaseModel):
    scenes: list[Scene]


# ── Public API ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = (Path(__file__).parent / "prompts" / "planner_system.txt").read_text()


def plan_scenes(paper: dict) -> ScenePlan:
    """Call Azure OpenAI to produce a scene plan for the given paper content."""
    client = AzureOpenAI(
        azure_endpoint=config.get("azure_openai_endpoint"),
        api_key=config.get("azure_openai_api_key"),
        api_version="2025-01-01-preview",
    )
    deployment = config.get("azure_openai_planner_deployment")

    user_content, image_map = _build_user_prompt(paper)

    resp = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.7,
        max_tokens=16384,
    )

    raw = resp.choices[0].message.content.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]

    data = json.loads(raw)
    plan = ScenePlan.model_validate(data)

    # Post-validation: ensure all templates exist, and resolve image keys
    for scene in plan.scenes:
        get_template(scene.template)
        # Resolve image_path keys (e.g. "fig_0") back to absolute paths
        if "image_path" in scene.data:
            key = scene.data["image_path"]
            if key in image_map:
                scene.data["image_path"] = image_map[key]

    return plan


def _build_user_prompt(paper: dict) -> tuple[str, dict[str, str]]:
    """Build the user prompt and return (prompt_text, image_key_to_path_map).

    Tables are passed as structured data (columns+rows) for the `data_table` template
    and are NOT included in the image_map. Only figures map to image keys.
    """
    image_map: dict[str, str] = {}  # key -> absolute path

    parts = [f"# {paper['title']}"]
    if paper.get("authors"):
        parts.append(f"Authors: {', '.join(paper['authors'])}")
    if paper.get("abstract"):
        parts.append(f"\n## Abstract\n{paper['abstract']}")

    # Build a quick lookup for figure/table keys by their number in captions
    fig_key_lookup: dict[int, str] = {}
    if paper.get("figures"):
        for i, fig in enumerate(paper["figures"]):
            caption = fig.get("caption", "")
            m = re.search(r"(?:Figure|Fig\.?)\s+(\d+)", caption, re.IGNORECASE)
            if m:
                fig_key_lookup[int(m.group(1))] = f"fig_{i}"

    table_key_lookup: dict[int, int] = {}
    if paper.get("tables"):
        for i, t in enumerate(paper["tables"]):
            caption = t.get("caption", "")
            m = re.search(r"Table\s+(\d+)", caption, re.IGNORECASE)
            if m:
                table_key_lookup[int(m.group(1))] = i

    # Sections with inline cross-references
    for sec in paper.get("sections", []):
        refs = []
        for fig_num in sec.get("fig_refs", []):
            key = fig_key_lookup.get(fig_num, f"Figure {fig_num}")
            refs.append(key if key.startswith("fig_") else f"Figure {fig_num}")
        for tbl_num in sec.get("table_refs", []):
            idx = table_key_lookup.get(tbl_num)
            refs.append(f"table_{idx}" if idx is not None else f"Table {tbl_num}")

        ref_line = f"  [References: {', '.join(refs)}]" if refs else ""
        parts.append(f"\n## {sec['heading']}{ref_line}\n{sec['body'][:2000]}")

    # Figures — each gets an image key
    if paper.get("figures"):
        parts.append("\n## Figures")
        for i, fig in enumerate(paper["figures"]):
            key = f"fig_{i}"
            image_map[key] = fig["path"]
            caption = fig.get("caption", "")
            caption_str = f' — "{caption}"' if caption else ""
            parts.append(f'- {key}: page {fig["page"]}{caption_str} (use image_path="{key}")')

    # Tables — structured data for data_table template (NOT image keys)
    if paper.get("tables"):
        parts.append("\n## Tables (MUST each get a `data_table` scene)")
        for i, t in enumerate(paper["tables"]):
            cols = t.get("columns", [])
            rows = t.get("rows", [])
            caption = t.get("caption", "Untitled")
            parts.append(f"### table_{i}: {caption}")
            parts.append(f"  Columns: {json.dumps(cols)}")
            # Show up to 10 rows to keep prompt size reasonable
            for row in rows[:10]:
                parts.append(f"  Row: {json.dumps(row)}")
            if len(rows) > 10:
                parts.append(f"  ... ({len(rows)} rows total)")

    return "\n".join(parts), image_map
