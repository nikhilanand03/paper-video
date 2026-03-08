"""Template registry — maps template names to metadata."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

TEMPLATES_DIR = Path(__file__).parent / "templates" / "scenes"


@dataclass(frozen=True)
class TemplateMeta:
    name: str
    file: str
    animated: bool
    animation_duration_ms: int  # 0 for static templates

    @property
    def path(self) -> Path:
        return TEMPLATES_DIR / self.file


# ── Registry ────────────────────────────────────────────────────────────────

_TEMPLATES: list[TemplateMeta] = [
    # --- Layout templates ---
    TemplateMeta("title_card",          "title_card.html",          animated=True, animation_duration_ms=1500),
    TemplateMeta("flashcard_list",      "flashcard_list.html",      animated=True, animation_duration_ms=1100),
    TemplateMeta("data_table",          "data_table.html",          animated=True, animation_duration_ms=1100),
    TemplateMeta("big_number",          "big_number.html",          animated=True, animation_duration_ms=1100),
    TemplateMeta("comparison_split",    "comparison_split.html",    animated=True, animation_duration_ms=1000),
    TemplateMeta("quote_highlight",     "quote_highlight.html",     animated=True, animation_duration_ms=1100),
    TemplateMeta("section_header",      "section_header.html",      animated=True, animation_duration_ms=1000),
    TemplateMeta("image_with_caption",  "image_with_caption.html",  animated=True, animation_duration_ms=1200),
    TemplateMeta("closing_card",        "closing_card.html",        animated=True, animation_duration_ms=1400),
    # --- Chart templates ---
    TemplateMeta("bar_chart",           "bar_chart.html",           animated=True, animation_duration_ms=900),
    TemplateMeta("grouped_bar_chart",   "grouped_bar_chart.html",   animated=True, animation_duration_ms=900),
    TemplateMeta("horizontal_bar_chart","horizontal_bar_chart.html",animated=True, animation_duration_ms=900),
    TemplateMeta("line_chart",          "line_chart.html",          animated=True, animation_duration_ms=900),
    TemplateMeta("scatter_plot",        "scatter_plot.html",        animated=True, animation_duration_ms=900),
    TemplateMeta("pie_donut_chart",     "pie_donut_chart.html",     animated=True, animation_duration_ms=1000),
    TemplateMeta("heatmap",             "heatmap.html",             animated=True, animation_duration_ms=900),
    TemplateMeta("multi_metric_cards",  "multi_metric_cards.html",  animated=True, animation_duration_ms=1100),
    # --- Legacy aliases (backward compat) ---
    TemplateMeta("bullet_list",         "flashcard_list.html",      animated=True, animation_duration_ms=1100),
    TemplateMeta("figure_display",      "image_with_caption.html",  animated=True, animation_duration_ms=1200),
    TemplateMeta("donut_chart",         "pie_donut_chart.html",     animated=True, animation_duration_ms=1000),
]

REGISTRY: dict[str, TemplateMeta] = {t.name: t for t in _TEMPLATES}
TEMPLATE_NAMES: list[str] = list(REGISTRY.keys())


def get_template(name: str) -> TemplateMeta:
    """Look up template by name. Raises KeyError if not found."""
    if name not in REGISTRY:
        raise KeyError(f"Unknown template '{name}'. Valid: {TEMPLATE_NAMES}")
    return REGISTRY[name]
