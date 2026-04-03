// Template types and display info (mirrors template_registry.py)

export const templateTypes = [
  "title_card", "flashcard_list", "data_table", "big_number",
  "comparison_split", "quote_highlight", "section_header",
  "image_with_caption", "closing_card",
  "bar_chart", "grouped_bar_chart", "horizontal_bar_chart",
  "line_chart", "scatter_plot", "pie_donut_chart",
  "heatmap", "multi_metric_cards",
] as const;

export type TemplateType = (typeof templateTypes)[number];

export const templateInfo: Record<
  string,
  { label: string; icon: string; category: "layout" | "chart" }
> = {
  title_card: { label: "Title Card", icon: "📄", category: "layout" },
  flashcard_list: { label: "Flashcard List", icon: "📋", category: "layout" },
  data_table: { label: "Data Table", icon: "📊", category: "layout" },
  big_number: { label: "Big Number", icon: "🔢", category: "layout" },
  comparison_split: { label: "Comparison", icon: "⚖️", category: "layout" },
  quote_highlight: { label: "Quote", icon: "💬", category: "layout" },
  section_header: { label: "Section Header", icon: "📑", category: "layout" },
  image_with_caption: { label: "Figure", icon: "🖼️", category: "layout" },
  closing_card: { label: "Closing", icon: "🏁", category: "layout" },
  bar_chart: { label: "Bar Chart", icon: "📊", category: "chart" },
  grouped_bar_chart: { label: "Grouped Bar", icon: "📊", category: "chart" },
  horizontal_bar_chart: { label: "Horizontal Bar", icon: "📊", category: "chart" },
  line_chart: { label: "Line Chart", icon: "📈", category: "chart" },
  scatter_plot: { label: "Scatter Plot", icon: "⚬", category: "chart" },
  pie_donut_chart: { label: "Donut Chart", icon: "🍩", category: "chart" },
  heatmap: { label: "Heatmap", icon: "🗺️", category: "chart" },
  multi_metric_cards: { label: "Multi Metrics", icon: "📏", category: "chart" },
};

export const processingStages = [
  { id: "extracting", label: "Extracting content", description: "Reading PDF, pulling text, tables, and figures" },
  { id: "planning", label: "Planning scenes", description: "AI selects templates and organizes the narrative" },
  { id: "rendering", label: "Rendering frames", description: "Generating visual slides and charts from templates" },
  { id: "synthesizing_tts", label: "Synthesizing narration", description: "Text-to-speech audio generation" },
  { id: "assembling", label: "Assembling video", description: "Stitching frames and audio into final MP4" },
];
