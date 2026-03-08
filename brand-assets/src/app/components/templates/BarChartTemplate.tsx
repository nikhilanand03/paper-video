import { Direction } from "../../data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell } from "recharts";

interface Props {
  direction: Direction;
}

const data = [
  { name: "ResNet", value: 76.1, isHighlighted: false },
  { name: "ViT", value: 81.8, isHighlighted: false },
  { name: "ConvNeXt", value: 82.1, isHighlighted: false },
  { name: "Ours", value: 83.9, isHighlighted: true },
];

export function BarChartTemplate({ direction }: Props) {
  const isA = direction === "A";
  const isD = direction === "D";

  const getColors = (isHighlighted: boolean) => {
    if (isA) return isHighlighted ? "var(--accent-primary)" : "#D1D5DB";
    if (isD) return isHighlighted ? "var(--accent-primary)" : "var(--bg-elevated)";
    return "#ccc";
  };

  return (
    <div 
      className="flex-1 flex flex-col px-12 lg:px-24 h-full relative" 
      style={{ 
        alignItems: isA ? "flex-start" : "center", 
        justifyContent: "center" 
      }}
    >
      <h2 
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: isA ? "38px" : "48px",
          fontWeight: 600,
          letterSpacing: isA ? "-0.5px" : "-1px",
          color: "var(--text-primary)",
          marginBottom: isA ? "40px" : "56px"
        }}
      >
        Accuracy vs Baselines
      </h2>

      <div 
        className="w-full h-[500px]"
        style={{
          background: isA ? "var(--bg-surface)" : "transparent",
          border: isA ? "var(--card-border)" : "none",
          borderRadius: isA ? "var(--card-radius)" : "0",
          boxShadow: isA ? "var(--card-shadow)" : "none",
          padding: isA ? "var(--card-padding)" : "0",
          maxWidth: isD ? "1000px" : "100%"
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 40, right: 30, left: 0, bottom: 20 }}>
            {/* A has horizontal grid, D has very subtle grid */}
            <CartesianGrid 
              strokeDasharray={isA ? "0 0" : "3 3"} 
              vertical={false} 
              stroke={isA ? "#F3F4F6" : "#1C1C1E"} 
            />
            
            <XAxis 
              dataKey="name" 
              axisLine={isA ? { stroke: "#D1D5DB" } : { stroke: "#2C2C2E" }}
              tickLine={false}
              tick={{ 
                fill: "var(--text-secondary)", 
                fontFamily: "var(--font-body)",
                fontSize: isA ? 16 : 20 
              }}
              dy={16}
            />
            
            {isA && (
              <YAxis 
                domain={[70, 85]} 
                axisLine={{ stroke: "#D1D5DB" }}
                tickLine={false}
                tick={{ 
                  fill: "var(--text-secondary)", 
                  fontFamily: "var(--font-body)",
                  fontSize: 16 
                }}
                dx={-8}
              />
            )}
            
            <Bar 
              dataKey="value" 
              barSize={isA ? 48 : 64}
              radius={isA ? [8, 8, 0, 0] : [12, 12, 0, 0]}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColors(entry.isHighlighted)} />
              ))}
              <LabelList 
                dataKey="value" 
                position="top" 
                fill={isA ? "#1A1A1A" : "#FFFFFF"}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: isA ? 500 : 600,
                  fontSize: isA ? 18 : 24,
                }}
                offset={isD ? 16 : 10}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div 
        className="w-full mt-6"
        style={{
          textAlign: isA ? "left" : "center",
          fontFamily: "var(--font-body)",
          fontSize: isA ? "16px" : "18px",
          color: "var(--text-secondary)",
          maxWidth: isD ? "1000px" : "100%"
        }}
      >
        Figure 3: ImageNet top-1 accuracy (Author et al. 2026)
      </div>
    </div>
  );
}
