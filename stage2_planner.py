"""Stage 2: Generate a scene plan from extracted paper content via Azure OpenAI."""

from __future__ import annotations

import json
from pathlib import Path

from openai import AzureOpenAI

import config
from pydantic import BaseModel


# ── Pydantic models ──────────────────────────────────────────────────────────

class Scene(BaseModel):
    scene_number: int
    scene_type: str
    title: str
    key_points: list[str]
    narration: str
    visual_description: str
    duration_seconds: int


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

    user_content = _build_user_prompt(paper)

    resp = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.7,
        max_tokens=4096,
    )

    raw = resp.choices[0].message.content.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]

    data = json.loads(raw)
    return ScenePlan.model_validate(data)


def _build_user_prompt(paper: dict) -> str:
    parts = [f"# {paper['title']}"]
    if paper.get("authors"):
        parts.append(f"Authors: {', '.join(paper['authors'])}")
    if paper.get("abstract"):
        parts.append(f"\n## Abstract\n{paper['abstract']}")
    for sec in paper.get("sections", []):
        parts.append(f"\n## {sec['heading']}\n{sec['body'][:2000]}")
    if paper.get("tables"):
        parts.append("\n## Tables")
        for t in paper["tables"][:5]:
            parts.append(t[:500])
    return "\n".join(parts)
