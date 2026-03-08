import { CSSProperties } from "react";
import { Direction } from "../data";

export function getThemeStyles(direction: Direction): CSSProperties {
  switch (direction) {
    case "A":
      return {
        "--bg-primary": "#FAFAF8",
        "--bg-surface": "#FFFFFF",
        "--bg-elevated": "#F4F4F0",
        "--text-primary": "#1A1A1A",
        "--text-secondary": "#6B7280",
        "--text-dim": "#9CA3AF",
        "--accent-primary": "#2563EB",
        "--accent-secondary": "#7C3AED",
        "--accent-positive": "#059669",
        "--accent-negative": "#DC2626",
        "--accent-amber": "#D97706",
        "--border-color": "#E5E7EB",
        "--border-accent": "rgba(37, 99, 235, 0.2)",
        "--font-title": "'Instrument Serif', serif",
        "--font-heading": "'Inter', sans-serif",
        "--font-body": "'Inter', sans-serif",
        "--font-mono": "'IBM Plex Mono', monospace",
        "--card-radius": "12px",
        "--card-shadow": "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
        "--card-border": "1px solid var(--border-color)",
        "--padding-safe": "96px 128px",
        "--card-padding": "32px",
      } as CSSProperties;
    case "D":
      return {
        "--bg-primary": "#000000",
        "--bg-surface": "#1C1C1E",
        "--bg-elevated": "#2C2C2E",
        "--text-primary": "#FFFFFF",
        "--text-secondary": "#8E8E93",
        "--text-dim": "#48484A",
        "--accent-primary": "#0A84FF",
        "--accent-secondary": "#30D158",
        "--accent-positive": "#30D158",
        "--accent-negative": "#FF453A",
        "--accent-amber": "#FFD60A",
        "--border-color": "transparent",
        "--border-accent": "transparent",
        "--font-title": "'Inter', sans-serif",
        "--font-heading": "'Inter', sans-serif",
        "--font-body": "'Inter', sans-serif",
        "--font-mono": "'Inter', monospace", // Keynote uses SF Mono, fallback to Inter
        "--card-radius": "20px",
        "--card-shadow": "none",
        "--card-border": "none",
        "--padding-safe": "120px",
        "--card-padding": "48px",
      } as CSSProperties;
  }
}
