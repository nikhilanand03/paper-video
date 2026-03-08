import { Direction } from "../../data";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, ReferenceDot } from "recharts";

interface Props {
  direction: Direction;
}

const data = [
  { epoch: "10", baseline: 65.4, ours: 68.2 },
  { epoch: "20", baseline: 71.2, ours: 75.8 },
  { epoch: "30", baseline: 74.8, ours: 80.1 },
  { epoch: "40", baseline: 76.5, ours: 82.4 },
  { epoch: "50", baseline: 77.1, ours: 83.9 },
];

export function LineChartTemplate({ direction }: Props) {
  const isA = direction === "A";
  const isD = direction === "D";

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
        Validation Accuracy over Time
      </h2>

      <div 
        className="w-full h-[500px]"
        style={{
          background: isA ? "var(--bg-surface)" : "transparent",
          border: isA ? "var(--card-border)" : "none",
          borderRadius: isA ? "var(--card-radius)" : "0",
          boxShadow: isA ? "var(--card-shadow)" : "none",
          padding: isA ? "var(--card-padding)" : "0",
          maxWidth: isD ? "1100px" : "100%"
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            {/* Grid */}
            <CartesianGrid 
              strokeDasharray={isA ? "0 0" : "3 3"} 
              vertical={false} 
              stroke={isA ? "#F3F4F6" : "#1C1C1E"} 
            />
            
            {/* Axes */}
            <XAxis 
              dataKey="epoch" 
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
                domain={[60, 90]} 
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

            {/* Lines */}
            <Line 
              type="monotone" 
              dataKey="baseline" 
              name="Baseline (ResNet-50)"
              stroke={isA ? "#DC2626" : "#2C2C2E"} // A: accent-negative (red) or text-secondary. Let's use red for baseline as per guidelines A.1. Or #6B7280. D uses #2C2C2E.
              strokeWidth={3} 
              dot={{ r: isA ? 8 : 10, fill: isA ? "#FFFFFF" : "#2C2C2E", strokeWidth: 2 }}
              activeDot={{ r: 12 }}
            />
            <Line 
              type="monotone" 
              dataKey="ours" 
              name="Ours (Proposed)"
              stroke="var(--accent-primary)" 
              strokeWidth={3} 
              dot={{ r: isA ? 8 : 10, fill: isA ? "#FFFFFF" : "var(--accent-primary)", strokeWidth: 2 }}
              activeDot={{ r: 12 }}
            />
            
            <Legend 
              verticalAlign={isD ? "bottom" : "top"} 
              height={isD ? 60 : 36}
              iconType="circle"
              iconSize={isA ? 12 : 16}
              wrapperStyle={{
                fontFamily: "var(--font-body)",
                fontSize: isA ? "14px" : "18px",
                color: "var(--text-secondary)",
                paddingTop: isD ? "40px" : "0",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div 
        className="w-full mt-6"
        style={{
          textAlign: isA ? "left" : "center",
          fontFamily: "var(--font-body)",
          fontSize: isA ? "16px" : "18px",
          color: "var(--text-secondary)",
          maxWidth: isD ? "1100px" : "100%"
        }}
      >
        Figure 4: Convergence speed comparison (Author et al. 2026)
      </div>
    </div>
  );
}
