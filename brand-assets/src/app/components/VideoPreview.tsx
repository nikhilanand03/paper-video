import { useEffect, useRef, useState } from "react";
import { Direction, AssetType } from "../data";
import { getThemeStyles } from "./ThemeStyles";

import { TitleCard } from "./templates/TitleCard";
import { SectionHeader } from "./templates/SectionHeader";
import { QuoteHighlight } from "./templates/QuoteHighlight";
import { BigNumber } from "./templates/BigNumber";
import { BulletList } from "./templates/BulletList";
import { DataTable } from "./templates/DataTable";
import { BarChartTemplate } from "./templates/BarChartTemplate";
import { LineChartTemplate } from "./templates/LineChartTemplate";
import { DonutChartTemplate } from "./templates/DonutChartTemplate";

interface VideoPreviewProps {
  direction: Direction;
  assetType: AssetType;
}

export function VideoPreview({ direction, assetType }: VideoPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const container = entries[0];
      if (container) {
        const { width, height } = container.contentRect;
        const scaleX = width / 1920;
        const scaleY = height / 1080;
        setScale(Math.min(scaleX, scaleY) * 0.95); 
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const styles = getThemeStyles(direction);

  const renderContent = () => {
    switch (assetType) {
      case "title_card": return <TitleCard direction={direction} />;
      case "section_header": return <SectionHeader direction={direction} />;
      case "quote_highlight": return <QuoteHighlight direction={direction} />;
      case "big_number": return <BigNumber direction={direction} />;
      case "bullet_list": return <BulletList direction={direction} />;
      case "data_table": return <DataTable direction={direction} />;
      case "bar_chart": return <BarChartTemplate direction={direction} />;
      case "line_chart": return <LineChartTemplate direction={direction} />;
      case "donut_chart": return <DonutChartTemplate direction={direction} />;
      default: return null;
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex items-center justify-center bg-zinc-900 rounded-xl overflow-hidden"
    >
      <div 
        className="relative shadow-2xl transition-all duration-500 ease-in-out"
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          ...styles
        }}
      >
        <div 
          className="w-full h-full flex flex-col"
          style={{ padding: 'var(--padding-safe)' }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
