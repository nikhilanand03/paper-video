"""Stage 3: Generate a self-contained HTML slide for each scene via Azure OpenAI."""

from __future__ import annotations

from pathlib import Path

from openai import AzureOpenAI

import config
from stage2_planner import Scene

SYSTEM_PROMPT = (Path(__file__).parent / "prompts" / "htmlgen_system.txt").read_text()


def generate_html(scene: Scene) -> str:
    """Return complete HTML string for a single scene."""
    client = AzureOpenAI(
        azure_endpoint=config.get("azure_openai_endpoint"),
        api_key=config.get("azure_openai_api_key"),
        api_version="2025-01-01-preview",
    )
    deployment = config.get("azure_openai_htmlgen_deployment")

    user_content = _build_prompt(scene)

    resp = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.5,
        max_tokens=4096,
    )

    html = resp.choices[0].message.content.strip()
    # Strip markdown fences if wrapped
    if html.startswith("```"):
        html = html.split("\n", 1)[1]
        html = html.rsplit("```", 1)[0]
    return html


def generate_all_html(scenes: list[Scene], output_dir: Path) -> list[Path]:
    """Generate HTML files for all scenes, returning list of paths."""
    output_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for scene in scenes:
        html = generate_html(scene)
        path = output_dir / f"scene_{scene.scene_number:03d}.html"
        path.write_text(html, encoding="utf-8")
        paths.append(path)
    return paths


def _build_prompt(scene: Scene) -> str:
    return (
        f"Scene {scene.scene_number}: {scene.title}\n"
        f"Type: {scene.scene_type}\n"
        f"Key points:\n" + "\n".join(f"- {p}" for p in scene.key_points) + "\n"
        f"Visual description: {scene.visual_description}\n"
        f"Narration: {scene.narration}\n"
        f"\nGenerate the HTML slide for this scene."
    )
