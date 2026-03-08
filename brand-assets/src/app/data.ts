export type Direction = "A" | "D";
export type AssetType = 
  | "title_card" 
  | "section_header" 
  | "big_number" 
  | "quote_highlight" 
  | "bullet_list" 
  | "data_table" 
  | "bar_chart" 
  | "line_chart" 
  | "donut_chart";

export const DIRECTIONS = [
  { id: "A", name: "Light Editorial", desc: "Nature article, beautiful typesetting" },
  { id: "D", name: "Apple Keynote", desc: "Billboard presentation, high contrast" },
] as const;

export const ASSET_TYPES = [
  { id: "title_card", name: "Title Card" },
  { id: "section_header", name: "Section Header" },
  { id: "quote_highlight", name: "Quote Highlight" },
  { id: "big_number", name: "Big Number" },
  { id: "bullet_list", name: "Bullet List" },
  { id: "data_table", name: "Data Table" },
  { id: "bar_chart", name: "Bar Chart" },
  { id: "line_chart", name: "Line Chart" },
  { id: "donut_chart", name: "Donut Chart" },
] as const;
