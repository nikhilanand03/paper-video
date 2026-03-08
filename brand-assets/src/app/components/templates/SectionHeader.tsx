import { Direction } from "../../data";

interface Props {
  direction: Direction;
}

export function SectionHeader({ direction }: Props) {
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
          background: isA ? "transparent" : "transparent", // In A, could be floating on warm bg
          maxWidth: isA ? "1000px" : "1200px",
          textAlign: isD ? "center" : "left",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: isA ? "24px" : "28px",
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "2px",
            marginBottom: isD ? "32px" : "24px"
          }}
        >
          Section 04
        </div>
        
        <h2
          style={{
            fontFamily: isA ? "var(--font-heading)" : "var(--font-title)", // A uses Inter for headings, D uses SF Pro (Inter here) at huge size
            fontSize: isA ? "64px" : "96px",
            fontWeight: isA ? 600 : 700,
            letterSpacing: isA ? "-1px" : "-3px",
            lineHeight: 1.1,
            color: "var(--text-primary)",
            marginBottom: isD ? "48px" : "32px"
          }}
        >
          Methodology & Approach
        </h2>
        
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: isA ? "28px" : "36px",
            fontWeight: 400,
            color: isA ? "var(--text-secondary)" : "var(--accent-primary)", // Apple often highlights subtitles
            lineHeight: 1.5,
            maxWidth: isA ? "800px" : "900px",
            margin: isD ? "0 auto" : "0"
          }}
        >
          A novel architecture for reducing computational overhead while maintaining state-of-the-art accuracy.
        </p>
      </div>
    </div>
  );
}
