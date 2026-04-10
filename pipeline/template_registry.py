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
    remotion_anim_frames: int = 120  # Frames to render in Remotion (rest is hold frame)

    @property
    def path(self) -> Path:
        return TEMPLATES_DIR / self.file

    @property
    def has_remotion(self) -> bool:
        return bool(self.remotion_comp_id)


# ── Registry ────────────────────────────────────────────────────────────────

_TEMPLATES: list[TemplateMeta] = [
    # --- Layout templates ---
    # remotion_anim_frames = frames needed for entrance animations (at 30fps)
    # Assembly holds the last frame for remaining TTS audio duration.
    TemplateMeta("title_card",          "title_card.html",          animated=True, animation_duration_ms=1500, remotion_comp_id="TitleCard",        remotion_anim_frames=90),
    TemplateMeta("flashcard_list",      "flashcard_list.html",      animated=True, animation_duration_ms=1100, remotion_comp_id="FlashcardList",    remotion_anim_frames=75),
    TemplateMeta("data_table",          "data_table.html",          animated=True, animation_duration_ms=1100, remotion_comp_id="DataTable",        remotion_anim_frames=75),
    TemplateMeta("big_number",          "big_number.html",          animated=True, animation_duration_ms=1100, remotion_comp_id="BigNumberScene",   remotion_anim_frames=75),
    TemplateMeta("comparison_split",    "comparison_split.html",    animated=True, animation_duration_ms=1000, remotion_comp_id="ComparisonSplit",  remotion_anim_frames=75),
    TemplateMeta("quote_highlight",     "quote_highlight.html",     animated=True, animation_duration_ms=1100, remotion_comp_id="QuoteHighlight",   remotion_anim_frames=75),
    TemplateMeta("section_header",      "section_header.html",      animated=True, animation_duration_ms=1000, remotion_comp_id="SectionHeader",    remotion_anim_frames=60),
    TemplateMeta("image_with_caption",  "image_with_caption.html",  animated=True, animation_duration_ms=1200, remotion_comp_id="ImageSlide",       remotion_anim_frames=90),
    TemplateMeta("closing_card",        "closing_card.html",        animated=True, animation_duration_ms=1400, remotion_comp_id="ClosingCard",      remotion_anim_frames=75),
    # --- Chart templates ---
    TemplateMeta("bar_chart",           "bar_chart.html",           animated=True, animation_duration_ms=900,  remotion_comp_id="BarChart",              remotion_anim_frames=60),
    TemplateMeta("grouped_bar_chart",   "grouped_bar_chart.html",   animated=True, animation_duration_ms=900,  remotion_comp_id="GroupedBarChart",       remotion_anim_frames=60),
    TemplateMeta("horizontal_bar_chart","horizontal_bar_chart.html",animated=True, animation_duration_ms=900,  remotion_comp_id="HorizontalBarChart",   remotion_anim_frames=60),
    TemplateMeta("line_chart",          "line_chart.html",          animated=True, animation_duration_ms=900,  remotion_comp_id="LineChart",             remotion_anim_frames=60),
    TemplateMeta("scatter_plot",        "scatter_plot.html",        animated=True, animation_duration_ms=900,  remotion_comp_id="ScatterPlot",           remotion_anim_frames=60),
    TemplateMeta("pie_donut_chart",     "pie_donut_chart.html",     animated=True, animation_duration_ms=1000, remotion_comp_id="DonutChart",            remotion_anim_frames=60),
    TemplateMeta("heatmap",             "heatmap.html",             animated=True, animation_duration_ms=900,  remotion_comp_id="Heatmap",               remotion_anim_frames=60),
    TemplateMeta("multi_metric_cards",  "multi_metric_cards.html",  animated=True, animation_duration_ms=1100, remotion_comp_id="MultiMetricCards",      remotion_anim_frames=75),
    # --- Legacy aliases (backward compat) ---
    TemplateMeta("bullet_list",         "flashcard_list.html",      animated=True, animation_duration_ms=1100, remotion_comp_id="BulletSlide",      remotion_anim_frames=75),
    TemplateMeta("figure_display",      "image_with_caption.html",  animated=True, animation_duration_ms=1200, remotion_comp_id="ImageSlide",       remotion_anim_frames=90),
    TemplateMeta("donut_chart",         "pie_donut_chart.html",     animated=True, animation_duration_ms=1000, remotion_comp_id="DonutChart",       remotion_anim_frames=60),
]

REGISTRY: dict[str, TemplateMeta] = {t.name: t for t in _TEMPLATES}
TEMPLATE_NAMES: list[str] = list(REGISTRY.keys())


def get_template(name: str) -> TemplateMeta:
    """Look up template by name. Raises KeyError if not found."""
    if name not in REGISTRY:
        raise KeyError(f"Unknown template '{name}'. Valid: {TEMPLATE_NAMES}")
    return REGISTRY[name]
