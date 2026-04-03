"""Template registry — maps template names to metadata."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "scenes"


@dataclass(frozen=True)
class TemplateMeta:
    name: str
    file: str
    animated: bool
    animation_duration_ms: int  # 0 for static templates
    remotion_comp_id: str = ""  # Remotion composition ID (empty = no Remotion preset)

    @property
    def path(self) -> Path:
        return TEMPLATES_DIR / self.file

    @property
    def has_remotion(self) -> bool:
        return bool(self.remotion_comp_id)


# ── Registry ────────────────────────────────────────────────────────────────

_TEMPLATES: list[TemplateMeta] = [
    # --- Layout templates ---
    TemplateMeta("title_card",          "title_card.html",          animated=True, animation_duration_ms=1500, remotion_comp_id="TitleCard"),
    TemplateMeta("flashcard_list",      "flashcard_list.html",      animated=True, animation_duration_ms=1100, remotion_comp_id="FlashcardList"),
    TemplateMeta("data_table",          "data_table.html",          animated=True, animation_duration_ms=1100, remotion_comp_id="DataTable"),
    TemplateMeta("big_number",          "big_number.html",          animated=True, animation_duration_ms=1100, remotion_comp_id="BigNumberScene"),
    TemplateMeta("comparison_split",    "comparison_split.html",    animated=True, animation_duration_ms=1000, remotion_comp_id="ComparisonSplit"),
    TemplateMeta("quote_highlight",     "quote_highlight.html",     animated=True, animation_duration_ms=1100, remotion_comp_id="QuoteHighlight"),
    TemplateMeta("section_header",      "section_header.html",      animated=True, animation_duration_ms=1000, remotion_comp_id="SectionHeader"),
    TemplateMeta("image_with_caption",  "image_with_caption.html",  animated=True, animation_duration_ms=1200),  # no Remotion preset yet
    TemplateMeta("closing_card",        "closing_card.html",        animated=True, animation_duration_ms=1400, remotion_comp_id="ClosingCard"),
    # --- Chart templates ---
    TemplateMeta("bar_chart",           "bar_chart.html",           animated=True, animation_duration_ms=900,  remotion_comp_id="BarChart"),
    TemplateMeta("grouped_bar_chart",   "grouped_bar_chart.html",   animated=True, animation_duration_ms=900,  remotion_comp_id="GroupedBarChart"),
    TemplateMeta("horizontal_bar_chart","horizontal_bar_chart.html",animated=True, animation_duration_ms=900,  remotion_comp_id="HorizontalBarChart"),
    TemplateMeta("line_chart",          "line_chart.html",          animated=True, animation_duration_ms=900,  remotion_comp_id="LineChart"),
    TemplateMeta("scatter_plot",        "scatter_plot.html",        animated=True, animation_duration_ms=900,  remotion_comp_id="ScatterPlot"),
    TemplateMeta("pie_donut_chart",     "pie_donut_chart.html",     animated=True, animation_duration_ms=1000, remotion_comp_id="DonutChart"),
    TemplateMeta("heatmap",             "heatmap.html",             animated=True, animation_duration_ms=900,  remotion_comp_id="Heatmap"),
    TemplateMeta("multi_metric_cards",  "multi_metric_cards.html",  animated=True, animation_duration_ms=1100, remotion_comp_id="MultiMetricCards"),
    # --- Legacy aliases (backward compat) ---
    TemplateMeta("bullet_list",         "flashcard_list.html",      animated=True, animation_duration_ms=1100, remotion_comp_id="BulletSlide"),
    TemplateMeta("figure_display",      "image_with_caption.html",  animated=True, animation_duration_ms=1200),
    TemplateMeta("donut_chart",         "pie_donut_chart.html",     animated=True, animation_duration_ms=1000, remotion_comp_id="DonutChart"),
]

REGISTRY: dict[str, TemplateMeta] = {t.name: t for t in _TEMPLATES}
TEMPLATE_NAMES: list[str] = list(REGISTRY.keys())


def get_template(name: str) -> TemplateMeta:
    """Look up template by name. Raises KeyError if not found."""
    if name not in REGISTRY:
        raise KeyError(f"Unknown template '{name}'. Valid: {TEMPLATE_NAMES}")
    return REGISTRY[name]
