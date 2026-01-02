"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function HomePage() {
  const supabase = useMemo(() => createClient(), []);
  const [authed, setAuthed] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setAuthed(!!data?.user);
    })();
  }, [supabase]);

  // Palette 1
  const colors = {
    bg: "#0B1220",
    card: "#111B2E",
    text: "#EAF0FF",
    muted: "rgba(234,240,255,0.70)",
    border: "rgba(234,240,255,0.14)",
    primary: "#3B82F6",
    accent: "#F97316",
  };

  const cardStyle: React.CSSProperties = {
    border: `1px solid ${colors.border}`,
    background: colors.card,
    borderRadius: 16,
    padding: 16,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        color: colors.text,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px 40px" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Inline logo (STØRRE) */}
            <svg width="80" height="80" viewBox="0 0 48 48" fill="none" aria-label="Volleymate">
              <rect x="0" y="0" width="48" height="48" rx="14" fill={colors.card} stroke={colors.border} />
              <path d="M13 12L20 34L27 12H33L23 36H17L7 12H13Z" fill={colors.primary} />
              <circle cx="34" cy="25" r="8" stroke={colors.accent} strokeWidth="2.6" />
              <path d="M30 22C33 20 35 20 38 22" stroke={colors.accent} strokeWidth="2.6" strokeLinecap="round" />
              <path d="M30 28C33 30 35 30 38 28" stroke={colors.accent} strokeWidth="2.6" strokeLinecap="round" />
            </svg>

            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 0.2 }}>Volleymate</div>
              <div style={{ fontSize: 12, color: colors.muted }}>Finn folk å spille med</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {authed ? (
              <Link
                href="/matches"
                style={{
                  textDecoration: "none",
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(234,240,255,0.04)",
                }}
              >
                Matches
              </Link>
            ) : (
              <Link
                href="/login"
                style={{
                  textDecoration: "none",
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(234,240,255,0.04)",
                }}
              >
                Logg inn
              </Link>
            )}
          </div>
        </div>

        {/* Hero */}
        <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
          <div style={{ ...cardStyle, padding: 20 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${colors.border}`,
                background: "rgba(234,240,255,0.04)",
                fontSize: 12,
                color: colors.muted,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: colors.accent,
                  display: "inline-block",
                }}
              />
              Lokale spillere • Requests • Chat
            </div>

            {/* HERO-TITTEL (ENDRET) */}
            <h1 style={{ fontSize: 36, margin: "14px 0 10px", lineHeight: 1.1 }}>
              Finn din volleyballmakker
            </h1>

            <p style={{ margin: 0, color: colors.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 560 }}>
              Lag en request med nivå og tid. Andre melder interesse. Når dere matcher, får dere egen chat – og så er det
              bare å møte opp og spille.
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <Link
                href="/requests/new"
                style={{
                  textDecoration: "none",
                  color: "#071426",
                  background: colors.primary,
                  padding: "12px 14px",
                  borderRadius: 12,
                  fontWeight: 800,
                }}
              >
                Lag request
              </Link>

              <Link
                href="/requests"
                style={{
                  textDecoration: "none",
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  background: "rgba(234,240,255,0.04)",
                  padding: "12px 14px",
                  borderRadius: 12,
                  fontWeight: 700,
                }}
              >
                Se åpne requests
              </Link>

              {authed && (
                <Link
                  href="/matches"
                  style={{
                    textDecoration: "none",
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                    background: "rgba(249,115,22,0.10)",
                    padding: "12px 14px",
                    borderRadius: 12,
                    fontWeight: 700,
                  }}
                >
                  Gå til matches
                </Link>
              )}
            </div>
          </div>

          {/* Side panel */}
          <div style={{ ...cardStyle, padding: 18 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Slik funker det</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ border: `1px solid ${colors.border}`, borderRadius: 14, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>1) Lag request</div>
                <div style={{ color: colors.muted, fontSize: 13, lineHeight: 1.5 }}>
                  Velg tid og nivå. Tom tid? Vi bruker default 18:00.
                </div>
              </div>

              <div style={{ border: `1px solid ${colors.border}`, borderRadius: 14, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>2) Folk melder seg</div>
                <div style={{ color: colors.muted, fontSize: 13, lineHeight: 1.5 }}>
                  “Jeg kan spille” legger seg som interesse på requesten.
                </div>
              </div>

              <div style={{ border: `1px solid ${colors.border}`, borderRadius: 14, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>3) Match & chat</div>
                <div style={{ color: colors.muted, fontSize: 13, lineHeight: 1.5 }}>
                  Når dere matcher får dere egen chat i matchen.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, color: colors.muted, fontSize: 12 }}>
              Tips: Del link til requesten med venner for raskere match.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 18, color: "rgba(234,240,255,0.55)", fontSize: 12 }}>
          Volleymate • mørk blå base + blå CTA + oransje highlight
        </div>
      </div>
    </div>
  );
}
