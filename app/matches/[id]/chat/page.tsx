"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string | null;
  content: string | null;
  created_at: string;
};

function timeHHMM(ts: string) {
  try {
    return new Date(ts).toLocaleString("no-NO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function dayLabel(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("no-NO", { weekday: "short", day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

export default function MatchChatPage() {
  const supabase = useMemo(() => createClient(), []);
  const params = useParams();
  const router = useRouter();

  const matchId = String(params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string; display_name: string | null } | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = (smooth = true) =>
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });

  const loadMessages = async () => {
    const { data, error: msgErr } = await supabase
      .from("messages")
      .select("id, match_id, sender_id, body, content, created_at")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (msgErr) {
      setError(msgErr.message);
      return;
    }
    setMessages((data ?? []) as MessageRow[]);
  };

  const markRead = async (userId: string) => {
    await supabase.from("match_reads").upsert(
      {
        match_id: matchId,
        user_id: userId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "match_id,user_id" }
    );
  };

  useEffect(() => {
    if (!matchId || matchId === "undefined") {
      setError("Ugyldig match-id.");
      setLoading(false);
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const run = async () => {
      setLoading(true);
      setError(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        router.push("/login");
        return;
      }
      const userId = authData.user.id;

      // display_name (robust: om profiles ikke har id, bare fallback)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .single();

      setMe({ id: userId, display_name: (profileData as any)?.display_name ?? null });

      await loadMessages();
      await markRead(userId);

      setLoading(false);
      scrollToBottom(false);

      channel = supabase
        .channel(`messages:match:${matchId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
          async () => {
            await loadMessages();
            await markRead(userId);
            // hvis du allerede er nær bunnen, scroll
            scrollToBottom(true);
          }
        )
        .subscribe();
    };

    run();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    // scroll når vi får nye meldinger
    scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const sendMessage = async () => {
    if (!me) return;

    const msg = text.trim();
    if (!msg) return;

    setError(null);

    const { error: insertError } = await supabase.from("messages").insert({
      match_id: matchId,
      sender_id: me.id,
      body: msg,
      content: msg,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setText("");
    await loadMessages();
    await markRead(me.id);
  };

  // Gruppér meldinger med “dag-separator”
  const rendered = (() => {
    const out: Array<{ type: "day"; key: string; label: string } | { type: "msg"; key: string; m: MessageRow }> = [];
    let lastDay = "";
    for (const m of messages) {
      const d = dayLabel(m.created_at);
      if (d !== lastDay) {
        out.push({ type: "day", key: `day-${m.created_at}`, label: d });
        lastDay = d;
      }
      out.push({ type: "msg", key: m.id, m });
    }
    return out;
  })();

  if (loading) {
    return (
      <div style={{ padding: 24, color: "var(--vm-text)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Chat</h1>
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
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: "rgba(11,18,32,0.85)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--vm-border)",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center" }}>
          <button
            onClick={() => router.push("/matches")}
            style={{
              border: "1px solid var(--vm-border)",
              background: "var(--vm-surface-2)",
              color: "var(--vm-text)",
              padding: "8px 10px",
              borderRadius: "var(--vm-radius-md)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ← Matches
          </button>

          <div style={{ marginLeft: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.1 }}>Chat</div>
            <div style={{ fontSize: 12, color: "var(--vm-muted)" }}>
              {me?.display_name ? `Du: ${me.display_name}` : " "}
            </div>
          </div>

          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--vm-muted)" }}>
            Match: <span style={{ opacity: 0.8 }}>{matchId.slice(0, 8)}…</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ maxWidth: 980, margin: "12px auto 0", padding: "0 16px" }}>
          <div
            style={{
              border: "1px solid rgba(255,0,0,0.35)",
              background: "rgba(255,0,0,0.06)",
              padding: 12,
              borderRadius: "var(--vm-radius-lg)",
            }}
          >
            <b>Feil:</b> {error}
          </div>
        </div>
      )}

      {/* Message list */}
      <div style={{ flex: 1, display: "flex" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "14px 16px 10px", width: "100%" }}>
          <div
            ref={listRef}
            style={{
              border: "1px solid var(--vm-border)",
              background: "var(--vm-surface)",
              borderRadius: "var(--vm-radius-lg)",
              padding: 14,
              height: "calc(100vh - 170px)",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.length === 0 ? (
              <div style={{ color: "var(--vm-muted)", padding: 8 }}>
                Ingen meldinger ennå. Send en første 👇
              </div>
            ) : (
              rendered.map((item) => {
                if (item.type === "day") {
                  return (
                    <div key={item.key} style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--vm-muted)",
                          padding: "4px 10px",
                          borderRadius: 999,
                          border: "1px solid var(--vm-border)",
                          background: "rgba(234,240,255,0.04)",
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                }

                const m = item.m;
                const isMine = me?.id === m.sender_id;
                const textToShow = (m.content ?? m.body ?? "").toString();

                return (
                  <div key={item.key} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
                    <div
                      style={{
                        maxWidth: "78%",
                        padding: "10px 12px",
                        borderRadius: 16,
                        border: "1px solid var(--vm-border)",
                        background: isMine ? "rgba(59,130,246,0.18)" : "rgba(234,240,255,0.04)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        lineHeight: 1.45,
                      }}
                    >
                      {textToShow}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--vm-muted)" }}>
                      {timeHHMM(m.created_at)}
                    </div>
                  </div>
                );
              })
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Composer */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 5,
          borderTop: "1px solid var(--vm-border)",
          background: "rgba(11,18,32,0.88)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "12px 16px", display: "flex", gap: 10 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Skriv en melding…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            style={{
              flex: 1,
              padding: "12px 12px",
              borderRadius: "var(--vm-radius-md)",
              border: "1px solid var(--vm-border)",
              background: "var(--vm-surface)",
              color: "var(--vm-text)",
              outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!text.trim()}
            style={{
              padding: "12px 14px",
              borderRadius: "var(--vm-radius-md)",
              border: "1px solid var(--vm-border)",
              background: text.trim() ? "var(--vm-primary)" : "rgba(234,240,255,0.04)",
              color: text.trim() ? "var(--vm-primary-text)" : "var(--vm-muted)",
              cursor: text.trim() ? "pointer" : "not-allowed",
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
