import { Direction } from "../../data";

interface Props {
  direction: Direction;
}

export function BigNumber({ direction }: Props) {
  const isA = direction === "A";
  const isD = direction === "D";

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-24 h-full relative">
      <div 
        className="flex flex-col items-center justify-center"
        style={{
          background: isA ? "var(--bg-surface)" : "transparent",
          border: isA ? "var(--card-border)" : "none",
          borderRadius: isA ? "12px" : "0",
          boxShadow: isA ? "var(--card-shadow)" : "none",
          padding: isA ? "80px 120px" : "0",
          width: isD ? "100%" : "auto"
        }}
      >
        <div 
          style={{
            fontSize: isA ? "120px" : "180px", 
            fontFamily: "var(--font-mono)", 
            fontWeight: isA ? 500 : 600, 
            color: isA ? "var(--accent-primary)" : "var(--text-primary)"
          }}
        >
          +42.7%
        </div>
        
        <div 
          style={{ 
            marginTop: isD ? "32px" : "24px", 
            fontSize: isA ? "38px" : "48px", 
            fontFamily: "var(--font-heading)", 
            fontWeight: 600, 
            color: isA ? "var(--text-primary)" : "var(--accent-primary)", 
            letterSpacing: isA ? "-0.5px" : "-1px" 
          }}
        >
          Improvement over baseline
        </div>

        {isA && (
          <div 
            style={{ 
              marginTop: "16px",
              fontFamily: "var(--font-body)",
              fontSize: "24px",
              color: "var(--text-secondary)",
              maxWidth: "600px",
              lineHeight: 1.6
            }}
          >
            Our novel architecture demonstrates state-of-the-art efficiency on the benchmark dataset.
          </div>
        )}
      </div>
    </div>
  );
}
