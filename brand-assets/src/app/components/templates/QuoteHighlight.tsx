import { Direction } from "../../data";

interface Props {
  direction: Direction;
}

export function QuoteHighlight({ direction }: Props) {
  const isA = direction === "A";
  const isD = direction === "D";

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
          maxWidth: isA ? "1200px" : "1400px",
          position: "relative",
          textAlign: isD ? "center" : "left",
        }}
      >
        {/* Quote mark decorative element */}
        <div 
          style={{
            fontFamily: "var(--font-title)",
            fontSize: isA ? "120px" : "160px",
            color: isA ? "var(--border-color)" : "var(--accent-primary)",
            lineHeight: 0,
            position: isD ? "relative" : "absolute",
            top: isA ? "90px" : "auto",
            left: isA ? "40px" : "auto",
            marginBottom: isD ? "40px" : "0",
            opacity: isD ? 0.8 : 1,
            display: isA ? "none" : "block", // Hide standard quote mark in A for cleaner editorial look
          }}
        >
          "
        </div>

        {isA && (
          <div 
            style={{
              width: "4px",
              height: "100px",
              backgroundColor: "var(--accent-primary)",
              position: "absolute",
              left: 0,
              top: "80px"
            }}
          />
        )}

        <blockquote
          style={{
            fontFamily: isA ? "var(--font-heading)" : "var(--font-body)",
            fontSize: isA ? "36px" : "56px",
            fontWeight: isA ? 400 : 600,
            letterSpacing: isA ? "-0.5px" : "-1px",
            lineHeight: isA ? 1.4 : 1.2,
            color: "var(--text-primary)",
            marginBottom: isA ? "40px" : "64px",
            fontStyle: isA ? "italic" : "normal", // Editorial uses italic, Keynote uses bold standard
          }}
        >
          {isD && <span style={{ color: "var(--accent-primary)", marginRight: "16px" }}>"</span>}
          The results demonstrate a paradigm shift in how we approach efficient visual design computation, surpassing previous state-of-the-art models by a significant margin.
          {isD && <span style={{ color: "var(--accent-primary)", marginLeft: "16px" }}>"</span>}
        </blockquote>

        <div 
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isD ? "center" : "flex-start",
            gap: "24px"
          }}
        >
          {isA && (
            <div 
              style={{
                width: "48px",
                height: "1px",
                backgroundColor: "var(--text-secondary)"
              }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span 
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: isA ? "24px" : "28px",
                fontWeight: 600,
                color: isA ? "var(--text-primary)" : "var(--text-secondary)"
              }}
            >
              Dr. Elena Rostova
            </span>
            <span 
              style={{
                fontFamily: "var(--font-body)",
                fontSize: isA ? "18px" : "24px",
                color: "var(--text-secondary)"
              }}
            >
              Lead Researcher, Vision Institute
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
