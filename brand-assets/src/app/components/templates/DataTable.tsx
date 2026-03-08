import { Direction } from "../../data";

interface Props {
  direction: Direction;
}

const data = [
  { model: "ResNet-50", params: "25.6M", acc: "76.1", speed: "14ms" },
  { model: "ViT-B/16", params: "86.6M", acc: "81.8", speed: "22ms" },
  { model: "ConvNeXt-T", params: "28.6M", acc: "82.1", speed: "18ms" },
  { model: "Ours", params: "24.0M", acc: "83.9", speed: "12ms", isOurs: true },
];

export function DataTable({ direction }: Props) {
  const isA = direction === "A";
  const isD = direction === "D";
  
  return (
    <div 
      className="flex-1 flex flex-col items-center justify-center px-12 lg:px-24 h-full relative"
      style={{
        alignItems: isD ? "center" : "flex-start" // A: Content left-aligned default
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
          textAlign: isD ? "center" : "left",
          width: "100%"
        }}
      >
        Model Performance Comparison
      </h2>

      <div 
        className="w-full"
        style={{
          background: isA ? "var(--bg-surface)" : "transparent",
          border: isA ? "var(--card-border)" : "none",
          borderRadius: isA ? "var(--card-radius)" : "0",
          boxShadow: isA ? "var(--card-shadow)" : "none",
          padding: isA ? "0" : "0", // Handled inside table for precise padding
          overflow: "hidden"
        }}
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr 
              style={{
                background: isA ? "#F9FAFB" : "transparent",
                borderBottom: isD ? "1px solid var(--bg-elevated)" : "none",
                fontFamily: isA ? "var(--font-body)" : "var(--font-heading)",
                fontSize: isA ? "15px" : "18px",
                fontWeight: 600,
                color: isA ? "var(--accent-primary)" : "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: isA ? "1px" : "2px",
              }}
            >
              <th className="py-4 px-6 font-semibold" style={{ padding: isA ? "16px 24px" : "20px 32px" }}>Model</th>
              <th className="py-4 px-6 font-semibold text-right" style={{ padding: isA ? "16px 24px" : "20px 32px" }}>Parameters</th>
              <th className="py-4 px-6 font-semibold text-right" style={{ padding: isA ? "16px 24px" : "20px 32px" }}>Accuracy (%)</th>
              <th className="py-4 px-6 font-semibold text-right" style={{ padding: isA ? "16px 24px" : "20px 32px" }}>Latency</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const highlighted = row.isOurs;
              return (
                <tr 
                  key={idx}
                  style={{
                    background: isA 
                      ? (highlighted ? "rgba(37, 99, 235, 0.06)" : (idx % 2 !== 0 ? "#F9FAFB" : "#FFFFFF"))
                      : "transparent",
                    borderBottom: isA ? "1px solid #E5E7EB" : "1px solid var(--bg-elevated)", // Extremely subtle for D
                    borderLeft: isA && highlighted ? `3px solid var(--accent-primary)` : "3px solid transparent",
                    fontFamily: "var(--font-body)",
                    fontSize: isA ? "24px" : "28px",
                    color: "var(--text-primary)",
                  }}
                >
                  <td 
                    style={{ 
                      padding: isA ? "16px 24px" : "20px 32px",
                      color: highlighted && isA ? "var(--accent-primary)" : "inherit",
                      fontWeight: highlighted && isA ? 600 : 400
                    }}
                  >
                    {row.model}
                  </td>
                  <td 
                    className="text-right" 
                    style={{ 
                      padding: isA ? "16px 24px" : "20px 32px",
                      fontFamily: "var(--font-mono)",
                      color: highlighted && isD ? "var(--text-primary)" : "inherit",
                      fontWeight: highlighted && isD ? 600 : 500
                    }}
                  >
                    {row.params}
                  </td>
                  <td 
                    className="text-right" 
                    style={{ 
                      padding: isA ? "16px 24px" : "20px 32px",
                      fontFamily: "var(--font-mono)",
                      color: highlighted && isD ? "var(--accent-primary)" : "inherit",
                      fontWeight: highlighted && isD ? 600 : 500
                    }}
                  >
                    {row.acc}
                  </td>
                  <td 
                    className="text-right" 
                    style={{ 
                      padding: isA ? "16px 24px" : "20px 32px",
                      fontFamily: "var(--font-mono)",
                      color: highlighted && isD ? "var(--text-primary)" : "inherit",
                      fontWeight: highlighted && isD ? 600 : 500
                    }}
                  >
                    {row.speed}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div 
        className="w-full mt-6"
        style={{
          textAlign: isA ? "left" : "center",
          fontFamily: "var(--font-body)",
          fontSize: isA ? "16px" : "18px",
          color: "var(--text-secondary)"
        }}
      >
        Table 1: ImageNet classification benchmark (Author et al. 2026)
      </div>
    </div>
  );
}
