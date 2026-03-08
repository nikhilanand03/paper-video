import { Direction } from "../../data";

interface Props {
  direction: Direction;
}

export function TitleCard({ direction }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-24">
      {direction === "D" ? (
        <div className="space-y-12 max-w-[1200px]">
          <h1 
            style={{ 
              fontFamily: "var(--font-title)", 
              fontSize: "72px", 
              fontWeight: 700, 
              letterSpacing: "-2px",
              lineHeight: 1.1,
              color: "var(--text-primary)"
            }}
          >
            A Systematic Review of Visual Design in Academic Video Presentations
          </h1>
          <p 
            style={{ 
              color: "var(--accent-primary)", 
              fontFamily: "var(--font-body)", 
              fontSize: "28px", 
              fontWeight: 400 
            }}
          >
            Author Name, Affiliation
          </p>
        </div>
      ) : (
        <div 
          className="w-full max-w-[1400px] flex flex-col justify-center items-center rounded-2xl p-16 relative overflow-hidden"
          style={{
            background: "var(--bg-surface)",
            border: "var(--card-border)",
            borderRadius: "var(--card-radius)",
            boxShadow: "var(--card-shadow)",
            padding: "var(--card-padding)"
          }}
        >
          <div className="w-full flex justify-between items-center mb-16 opacity-80"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "16px",
              color: "var(--text-secondary)",
              letterSpacing: "normal",
            }}
          >
            <span>RESEARCH PAPER</span>
            <span>MAY 2026</span>
          </div>

          <h1 
            style={{ 
              fontFamily: "var(--font-title)", 
              fontSize: "60px", 
              fontWeight: 400, 
              letterSpacing: "-1px",
              lineHeight: 1.2,
              marginBottom: "40px",
              color: "var(--text-primary)"
            }}
          >
            A Systematic Review of Visual Design in Academic Video Presentations
          </h1>
          
          <div className="flex gap-16 items-center w-full justify-center mt-12">
            <div className="flex flex-col items-center gap-2">
              <span style={{ color: "var(--text-primary)", fontSize: "24px", fontFamily: "var(--font-heading)" }}>
                Dr. Jane Doe
              </span>
              <span style={{ color: "var(--accent-primary)", fontSize: "16px", fontFamily: "var(--font-body)" }}>
                MIT CSAIL
              </span>
            </div>
            <div style={{ width: "1px", height: "40px", backgroundColor: "var(--border-color)" }} />
            <div className="flex flex-col items-center gap-2">
              <span style={{ color: "var(--text-primary)", fontSize: "24px", fontFamily: "var(--font-heading)" }}>
                John Smith
              </span>
              <span style={{ color: "var(--accent-primary)", fontSize: "16px", fontFamily: "var(--font-body)" }}>
                Stanford AI Lab
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
