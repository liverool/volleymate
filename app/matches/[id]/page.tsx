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

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

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
    scrollToBottom();
  }, [messages.length]);

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

      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .single();

      setMe({ id: userId, display_name: (profileData as any)?.display_name ?? null });

      await loadMessages();
      await markRead(userId);
      setLoading(false);

      channel = supabase
        .channel(`messages:match:${matchId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
          async () => {
            await loadMessages();
            await markRead(userId);
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

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Chat</h1>
        <p>Laster…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Chat</h1>

        <button
          onClick={() => router.push("/matches")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          ← Matches
        </button>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(255,0,0,0.35)" }}>
          <b>Feil:</b> {error}
        </div>
      )}

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          padding: 12,
          height: "60vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {messages.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Ingen meldinger ennå. Send en første 👇</p>
        ) : (
          messages.map((m) => {
            const isMine = me?.id === m.sender_id;
            const textToShow = (m.content ?? m.body ?? "").toString();

            return (
              <div
                key={m.id}
                style={{
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                  {isMine ? (me?.display_name ? me.display_name : "Meg") : "Motpart"} •{" "}
                  {new Date(m.created_at).toLocaleString("no-NO", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{textToShow}</div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
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
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim()}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: text.trim() ? "rgba(255,255,255,0.08)" : "transparent",
            cursor: text.trim() ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
      </div>

      <div style={{ opacity: 0.7, fontSize: 12 }}>Match: {matchId}</div>
    </div>
  );
}
