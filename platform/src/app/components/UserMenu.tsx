import { useState, useRef, useEffect } from "react";
import type { User } from "@supabase/supabase-js";

export default function UserMenu({ user, signOut }: { user: User; signOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const name = user.user_metadata?.full_name || user.email || "User";
  const initial = name[0].toUpperCase();
  const firstName = user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "User";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Avatar pill */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "4px 12px 4px 4px",
          border: "1px solid #E4E4E7", borderRadius: 20,
          cursor: "pointer",
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: "#4F6EF7",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#FFFFFF", fontWeight: 600 }}>
            {initial}
          </span>
        </div>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#1A1A1A", fontWeight: 500 }}>
          {firstName}
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 220,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E4E4E7", borderRadius: 12,
          padding: "8px 0",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          zIndex: 50,
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F4F4F5" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#1A1A1A", fontWeight: 500 }}>
              {name}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#A1A1AA", marginTop: 2 }}>
              {user.email}
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 16px", background: "none", border: "none",
              fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#3F3F46",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F4F4F5")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
