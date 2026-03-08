import { Direction } from "../../data";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

interface Props {
  direction: Direction;
}

const data = [
  { name: "Attention Head", value: 45 },
  { name: "FFN Layers", value: 30 },
  { name: "Embedding", value: 15 },
  { name: "Other", value: 10 },
];

export function DonutChartTemplate({ direction }: Props) {
  const isA = direction === "A";
  const isD = direction === "D";

  const getColors = () => {
    if (isA) return ["var(--accent-primary)", "var(--accent-secondary)", "var(--accent-positive)", "#D1D5DB"];
    if (isD) return ["var(--accent-primary)", "#2C2C2E", "#1C1C1E", "#0A0A0A"];
    return [];
  };

  const colors = getColors();

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
          marginBottom: isA ? "40px" : "56px",
          textAlign: isA ? "left" : "center",
          width: "100%",
        }}
      >
        Parameter Distribution
      </h2>

      <div 
        className="w-full flex"
        style={{
          background: isA ? "var(--bg-surface)" : "transparent",
          border: isA ? "var(--card-border)" : "none",
          borderRadius: isA ? "var(--card-radius)" : "0",
          boxShadow: isA ? "var(--card-shadow)" : "none",
          padding: isA ? "var(--card-padding)" : "0",
          maxWidth: isD ? "1000px" : "100%",
          height: isA ? "400px" : "500px",
          alignItems: "center",
          justifyContent: isD ? "center" : "flex-start",
        }}
      >
        <div style={{ width: isD ? "500px" : "400px", height: "100%", position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={isA ? 120 : 140}
                outerRadius={isA ? 200 : 220}
                paddingAngle={isA ? 4 : 6}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Centered label */}
          <div 
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ 
              fontFamily: "var(--font-mono)", 
              fontSize: isA ? "48px" : "64px", 
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1
            }}>
              24M
            </span>
            <span style={{ 
              fontFamily: "var(--font-body)", 
              fontSize: isA ? "16px" : "20px", 
              color: "var(--text-secondary)",
              marginTop: "8px"
            }}>
              Total Params
            </span>
          </div>
        </div>

        <div style={{ marginLeft: isD ? "64px" : "48px", display: "flex", flexDirection: "column", gap: isA ? "16px" : "24px" }}>
          {data.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div 
                style={{ 
                  width: isA ? "12px" : "16px", 
                  height: isA ? "12px" : "16px", 
                  borderRadius: isA ? "4px" : "50%", 
                  backgroundColor: colors[i % colors.length] 
                }} 
              />
              <span style={{ 
                fontFamily: "var(--font-body)", 
                fontSize: isA ? "18px" : "24px", 
                color: i === 0 && isD ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: i === 0 && isD ? 600 : 400
              }}>
                {item.name}
              </span>
              <span style={{ 
                fontFamily: "var(--font-mono)", 
                fontSize: isA ? "18px" : "24px", 
                color: "var(--text-primary)",
                marginLeft: "auto",
                paddingLeft: "32px"
              }}>
                {item.value}%
              </span>
            </div>
          ))}
        </div>
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
        Figure 5: Parameter breakdown by module type
      </div>
    </div>
  );
}
