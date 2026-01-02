"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type RequestInterestAgg = { count: number };

type RequestRow = {
  id: string;
  user_id: string | null;
  created_at: string | null;

  municipality: string | null;
  location_text: string | null;

  start_time: string | null; // timestamptz
  duration_minutes: number | null;

  level_min: number | null;
  level_max: number | null;

  type: string | null; // session_type (enum i db, men kommer som string)
  notes: string | null;

  status: string | null;

  // embedded aggregate
  request_interests?: RequestInterestAgg[] | null;

  // flat count
  interest_count?: number;
};

function formatStartTime(iso: string | null) {
  if (!iso) return "";
  try {
    // no-NO, viser f.eks. 01.01.2026 18:30
    return new Date(iso).toLocaleString("no-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatLevel(r: RequestRow) {
  const a = r.level_min;
  const b = r.level_max;
  if (a == null && b == null) return "";
  if (a != null && b != null) return `${a}–${b}`;
  if (a != null) return `min ${a}`;
  return `max ${b}`;
}

function typeLabel(type: string | null) {
  if (!type) return "Request";
  // gjør enum-string litt penere
  return type.replaceAll("_", " ");
}

export default function RequestsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);

  const [mine, setMine] = useState<RequestRow[]>([]);
  const [open, setOpen] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        window.location.href = "/login";
        return;
      }
      const uid = authData.user.id;
      setMeId(uid);

      const { data, error: reqErr } = await supabase
        .from("requests")
        .select(
          `
          id,
          user_id,
          created_at,
          municipality,
          location_text,
          start_time,
          duration_minutes,
          level_min,
          level_max,
          type,
          notes,
          status,
          request_interests(count)
        `
        )
        .order("created_at", { ascending: false });

      if (reqErr) {
        setError(reqErr.message);
        setLoading(false);
        return;
      }

      const rowsRaw = (data || []) as unknown as RequestRow[];

      const rows = rowsRaw.map((r) => ({
        ...r,
        interest_count: r.request_interests?.[0]?.count ?? 0,
      }));

      setMine(rows.filter((r) => r.user_id === uid));

      const openRows = rows.filter((r) => {
        const st = (r.status ?? "").toLowerCase();
        return r.user_id !== uid && !["matched", "closed", "done"].includes(st);
      });
      setOpen(openRows);

      setLoading(false);
    })();
  }, [supabase]);

  const pageWrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "var(--vm-bg)",
    color: "var(--vm-text)",
  };

  const container: React.CSSProperties = {
    maxWidth: 960,
    margin: "0 auto",
    padding: 24,
  };

  const card: React.CSSProperties = {
    background: "var(--vm-surface)",
    border: "1px solid var(--vm-border)",
    borderRadius: "var(--vm-radius-lg)",
    padding: 16,
  };

  const pill = (text: string) => (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid var(--vm-border)",
        background: "var(--vm-surface-2)",
        color: "var(--vm-muted)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );

  const interestBadge = (n: number) => (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid var(--vm-border)",
        background: "rgba(56, 139, 253, 0.10)",
        color: "var(--vm-text)",
        whiteSpace: "nowrap",
        fontWeight: 800,
      }}
      title="Antall interesser"
    >
      👀 {n}
    </span>
  );

  const renderRequestCard = (r: RequestRow) => {
    const title = typeLabel(r.type);
    const place = r.municipality ?? "";
    const loc = r.location_text ?? "";
    const when = formatStartTime(r.start_time);
    const duration = r.duration_minutes != null ? `${r.duration_minutes} min` : "";
    const level = formatLevel(r);
    const interestCount = r.interest_count ?? 0;

    // valgfritt: kort preview av notes
    const notes = (r.notes ?? "").trim();
    const notesShort = notes.length > 60 ? notes.slice(0, 60) + "…" : notes;

    return (
      <Link
        key={r.id}
        href={`/requests/${r.id}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div style={{ ...card, display: "flex", justifyContent: "space-between", gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>{title}</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {place && pill(place)}
              {loc && pill(loc)}
              {when && pill(when)}
              {duration && pill(duration)}
              {level && pill(`Nivå: ${level}`)}

              {interestCount > 0 && interestBadge(interestCount)}

              {!place && !loc && !when && !duration && !level && interestCount === 0 && (
                <span style={{ color: "var(--vm-muted)" }}>—</span>
              )}
            </div>

            {notesShort && (
              <div style={{ marginTop: 8, color: "var(--vm-muted)", fontSize: 13, lineHeight: 1.4 }}>
                {notesShort}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <span
              style={{
                padding: "10px 12px",
                borderRadius: "var(--vm-radius-md)",
                border: "1px solid var(--vm-border)",
                background: "rgba(234,240,255,0.04)",
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              Åpne →
            </span>
          </div>
        </div>
      </Link>
    );
  };

  if (loading) {
    return (
      <div style={{ ...pageWrap, padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Requests</h1>
        <p style={{ color: "var(--vm-muted)" }}>Laster…</p>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={container}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Requests</h1>

          <Link
            href="/requests/new"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--vm-radius-md)",
              background: "var(--vm-primary)",
              color: "var(--vm-primary-text)",
              fontWeight: 900,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            + Ny request
          </Link>
        </div>

        {error && (
          <div style={{ marginTop: 12, ...card, border: "1px solid rgba(255,0,0,0.35)", background: "rgba(255,0,0,0.06)" }}>
            <b>Feil:</b> {error}
            <div style={{ color: "var(--vm-muted)", fontSize: 12, marginTop: 6 }}>
              Hvis feilen sier “Could not find a relationship … request_interests”, så mangler du tabell/relasjon – si ifra så sender jeg 1 SQL.
            </div>
          </div>
        )}

        {/* Mine */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 10px" }}>Mine requests</h2>
            {meId && <span style={{ color: "var(--vm-muted)", fontSize: 12 }}>Innlogget</span>}
          </div>

          {mine.length === 0 ? (
            <div style={{ ...card, color: "var(--vm-muted)" }}>Du har ingen requests ennå.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{mine.map(renderRequestCard)}</div>
          )}
        </div>

        {/* Åpne */}
        <div style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 10px" }}>Åpne requests</h2>

          {open.length === 0 ? (
            <div style={{ ...card, color: "var(--vm-muted)" }}>Ingen åpne requests akkurat nå.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{open.map(renderRequestCard)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
