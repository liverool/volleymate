"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MatchesNavLink() {
  const pathname = usePathname();
  const active = isActive(pathname, "/matches");

  // Placeholder for i kveld – setter vi riktig query i morgen
  const [count, setCount] = useState(0);

  useEffect(() => {
    // TODO i morgen: hent ekte unread count via match_reads
    setCount(0);
  }, []);

  return (
    <Link
      href="/matches"
      style={{
        textDecoration: "none",
        fontWeight: 800,
        padding: "8px 10px",
        borderRadius: 10,
        color: active ? "var(--vm-text)" : "var(--vm-muted)",
        background: active ? "var(--vm-surface)" : "transparent",
        border: active ? "1px solid var(--vm-border)" : "1px solid transparent",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>Matches</span>

      {count > 0 && (
        <span
          style={{
            minWidth: 20,
            height: 20,
            padding: "0 6px",
            borderRadius: 999,
            background: "var(--vm-accent)",
            color: "var(--vm-bg)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 900,
            lineHeight: 1,
          }}
          title={`${count} uleste`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
