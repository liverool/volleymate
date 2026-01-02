"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function UserMenu() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      setEmail(data?.user?.email ?? null);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const btnStyle: Record<string, string | number> = {
    textDecoration: "none",
    fontWeight: 800,
    padding: "8px 10px",
    borderRadius: 10,
    color: "var(--vm-muted)",
    background: "transparent",
    border: "1px solid transparent",
  };

  const activeBtnStyle: Record<string, string | number> = {
    ...btnStyle,
    color: "var(--vm-text)",
    background: "var(--vm-surface)",
    border: "1px solid var(--vm-border)",
  };

  async function onLogout() {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12, color: "var(--vm-muted)", whiteSpace: "nowrap" }}>
        {loading ? "…" : email ? email : ""}
      </span>

      <Link href="/me" style={activeBtnStyle}>
        Meg
      </Link>

      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        style={{
          ...btnStyle,
          border: "1px solid var(--vm-border)",
          background: "rgba(255,255,255,0.02)",
          color: "var(--vm-text)",
          cursor: loggingOut ? "not-allowed" : "pointer",
        }}
      >
        {loggingOut ? "Logger ut…" : "Logg ut"}
      </button>
    </div>
  );
}
