"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MatchesNavLink from "./MatchesNavLink";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function TopNav() {
  const pathname = usePathname();

  const linkStyle = (href: string): React.CSSProperties => {
    const active = isActive(pathname, href);

    return {
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
    };
  };

  return (
    <nav style={{ display: "flex", gap: 8 }}>
      <Link href="/requests" style={linkStyle("/requests")}>
        Requests
      </Link>

      {/* Matches med badge */}
      <MatchesNavLink />
    </nav>
  );
}
