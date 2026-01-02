"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type MatchRow = {
  id: string;
  owner_user_id: string | null;
  interested_user_id: string | null;
  created_at?: string | null;
};

type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string | null;
  content: string | null;
  created_at: string;
};

type MatchReadRow = {
  match_id: string;
  last_read_at: string;
};

function formatTime(ts?: string | null) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("no-NO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MatchesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [lastByMatchId, setLastByMatchId] = useState<Record<string, MessageRow | null>>({});
  const [readByMatchId, setReadByMatchId] = useState<Record<string, string | null>>({});

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const uid = auth.user.id;
      setMeId(uid);

      // Matches
      const { data: matchData } = await supabase
        .from("matches")
        .select("id, owner_user_id, interested_user_id, created_at")
        .or(`owner_user_id.eq.${uid},interested_user_id.eq.${uid}`)
        .order("created_at", { ascending: false });

      const ms = (matchData ?? []) as MatchRow[];
      setMatches(ms);

      const ids = ms.map((m) => m.id);
      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      // Last message per match
      const { data: msgData } = await supabase
        .from("messages")
        .select("id, match_id, sender_id, body, content, created_at")
        .in("match_id", ids)
        .order("created_at", { ascending: false });

      const lastMap: Record<string, MessageRow | null> = Object.fromEntries(ids.map((id) => [id, null]));
      for (const m of msgData ?? []) {
        if (!lastMap[m.match_id]) lastMap[m.match_id] = m;
      }
      setLastByMatchId(lastMap);

      // Read state
      const { data: readData } = await supabase
        .from("match_reads")
        .select("match_id, last_read_at")
        .eq("user_id", uid)
        .in("match_id", ids);

      const readMap: Record<string, string | null> = Object.fromEntries(ids.map((id) => [id, null]));
      for (const r of (readData ?? []) as MatchReadRow[]) {
        readMap[r.match_id] = r.last_read_at;
      }
      setReadByMatchId(readMap);

      setLoading(false);
    })();
  }, [supabase]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--vm-bg)",
          color: "var(--vm-text)",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Matches</h1>
        <p style={{ color: "var(--vm-muted)" }}>Laster…</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--vm-bg)",
        color: "var(--vm-text)",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 18 }}>Matches</h1>

        {matches.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--vm-border)",
              borderRadius: "var(--vm-radius-lg)",
              padding: 20,
              color: "var(--vm-muted)",
            }}
          >
            Ingen matcher ennå.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {matches.map((m) => {
              const last = lastByMatchId[m.id];
              const lastText = (last?.content ?? last?.body ?? "").trim();
              const lastReadAt = readByMatchId[m.id];

              const unread =
                !!last &&
                (!lastReadAt || new Date(last.created_at).getTime() > new Date(lastReadAt).getTime());

              const mine = meId && last?.sender_id === meId;

              return (
                <div
                  key={m.id}
                  style={{
                    background: "var(--vm-surface)",
                    border: "1px solid var(--vm-border)",
                    borderRadius: "var(--vm-radius-lg)",
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontWeight: 800 }}>Match</div>
                      {unread && (
                        <span
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "var(--vm-accent-soft)",
                            border: "1px solid var(--vm-accent)",
                          }}
                        >
                          ULest
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: 8, fontSize: 14 }}>
                      {last ? (
                        <>
                          <span style={{ color: "var(--vm-muted)", marginRight: 6 }}>
                            {mine ? "Du:" : "Motpart:"}
                          </span>
                          <span
                            style={{
                              display: "inline-block",
                              maxWidth: 420,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {lastText || "(tom)"}
                          </span>
                          <span style={{ color: "var(--vm-muted)", marginLeft: 8 }}>
                            · {formatTime(last.created_at)}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: "var(--vm-muted)" }}>(ingen meldinger ennå)</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center" }}>
                    <Link
                      href={`/matches/${m.id}/chat`}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "var(--vm-radius-md)",
                        background: "var(--vm-primary)",
                        color: "var(--vm-primary-text)",
                        fontWeight: 800,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Åpne chat
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
