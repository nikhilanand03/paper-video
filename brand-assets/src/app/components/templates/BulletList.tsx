import { Direction } from "../../data";

interface Props {
  direction: Direction;
}

export function BulletList({ direction }: Props) {
  const isA = direction === "A";
  const isD = direction === "D";

  const items = [
    "Reduces computational overhead by 40% without sacrificing accuracy.",
    "Introduces a novel attention mechanism specifically optimized for edge devices.",
    "Outperforms the baseline ResNet-50 across all major classification benchmarks.",
    "Scales linearly with resolution, unlocking native 4K processing."
  ];

  return (
    <div 
      className="flex-1 flex flex-col h-full relative"
      style={{
        alignItems: isA ? "flex-start" : "center",
        justifyContent: "center",
        padding: isA ? "0 128px" : "0",
      }}
    >
      <div 
        style={{
          background: isA ? "var(--bg-surface)" : "transparent",
          border: isA ? "var(--card-border)" : "none",
          borderRadius: isA ? "var(--card-radius)" : "0",
          boxShadow: isA ? "var(--card-shadow)" : "none",
          padding: isA ? "80px" : "0",
          width: "100%",
          maxWidth: isD ? "1200px" : "100%"
        }}
      >
        <h2 
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: isA ? "38px" : "56px",
            fontWeight: 600,
            letterSpacing: isA ? "-0.5px" : "-1px",
            color: "var(--text-primary)",
            marginBottom: isA ? "40px" : "80px",
            textAlign: isD ? "center" : "left",
          }}
        >
          Key Contributions
        </h2>

        <ul 
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: isA ? "32px" : "48px"
          }}
        >
          {items.map((item, index) => (
            <li 
              key={index}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: isA ? "24px" : "32px",
                fontFamily: "var(--font-body)",
                fontSize: isA ? "24px" : "32px",
                color: isD && index === 0 ? "var(--text-primary)" : "var(--text-secondary)", // D often highlights the first bullet or fades them in
                fontWeight: isD && index === 0 ? 600 : 400,
                lineHeight: 1.5,
              }}
            >
              <div 
                style={{
                  width: isA ? "12px" : "16px",
                  height: isA ? "12px" : "16px",
                  borderRadius: "50%",
                  backgroundColor: isD ? "var(--accent-primary)" : "var(--accent-primary)",
                  marginTop: isA ? "12px" : "16px",
                  flexShrink: 0
                }}
              />
              <span style={{ color: isD && index !== 0 ? "var(--text-secondary)" : "var(--text-primary)" }}>
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
