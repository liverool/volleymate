"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type RequestRow = {
  id: string;
  user_id: string | null;
  created_at: string | null;
  municipality: string | null;
  location_text: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  level_min: number | null;
  level_max: number | null;
  type: string | null;
  notes: string | null;
  status: string | null;
};

type InterestRow = {
  request_id: string;
  user_id: string;
  created_at: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("no-NO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RequestDetailsPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const id = useMemo(() => {
    const raw = (params as any)?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [row, setRow] = useState<RequestRow | null>(null);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [matchIdForMe, setMatchIdForMe] = useState<string | null>(null);

  const isOwner = !!userId && !!row?.user_id && userId === row.user_id;
  const isClosed = row?.status === "closed" || row?.status === "done";

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setMsg("");

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id ?? null;
    setUserId(uid);

    const { data: req, error: reqErr } = await supabase
      .from("requests")
      .select("*")
      .eq("id", id)
      .single();

    if (reqErr) {
      setMsg(reqErr.message);
      setLoading(false);
      return;
    }

    setRow(req as RequestRow);

    if (uid && req.user_id === uid) {
      const { data } = await supabase
        .from("request_interests")
        .select("request_id, user_id, created_at")
        .eq("request_id", id)
        .order("created_at", { ascending: false });

      setInterests((data ?? []) as InterestRow[]);
    } else {
      setInterests([]);
    }

    if (uid && req.user_id) {
      const { data } = await supabase
        .from("matches")
        .select("id")
        .eq("request_id", id)
        .or(
          `and(owner_user_id.eq.${uid},interested_user_id.eq.${req.user_id}),and(owner_user_id.eq.${req.user_id},interested_user_id.eq.${uid})`
        )
        .maybeSingle();

      setMatchIdForMe((data as any)?.id ?? null);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function approveInterest(interestedUserId: string) {
    try {
      if (!isOwner || !row?.user_id || !id) {
        setMsg("Mangler rettigheter eller data.");
        return;
      }

      setBusy(true);
      setMsg("Godkjenner interesse…");

      const { data: created, error } = await supabase
        .from("matches")
        .insert({
          request_id: id,
          owner_user_id: row.user_id,
          interested_user_id: interestedUserId,
        })
        .select("id")
        .single();

      if (error) {
        setMsg(`Kunne ikke opprette match: ${error.message}`);
        return;
      }

      const matchId = (created as any)?.id;
      if (!matchId) {
        setMsg("Match opprettet, men fikk ikke ID (RLS på SELECT?).");
        return;
      }

      router.push(`/matches/${matchId}/chat`);
    } catch (e: any) {
      setMsg(`Feil: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function rejectInterest(interestedUserId: string) {
    if (!isOwner || !id) return;

    setBusy(true);
    setMsg("");

    const { error } = await supabase
      .from("request_interests")
      .delete()
      .eq("request_id", id)
      .eq("user_id", interestedUserId);

    if (error) {
      setMsg(error.message);
    } else {
      setMsg("Interesse fjernet.");
      await loadAll();
    }

    setBusy(false);
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Laster…</div>;
  }

  if (!row) {
    return <div style={{ padding: 20 }}>Request ikke funnet.</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <Link href="/requests">← Tilbake</Link>

      <h1 style={{ fontSize: 28, marginTop: 10 }}>Request</h1>

      <p>
        <strong>{row.municipality}</strong>
        {row.start_time ? ` · ${fmtDate(row.start_time)}` : ""}
      </p>

      {matchIdForMe && (
        <Link
          href={`/matches/${matchIdForMe}/chat`}
          style={{
            display: "inline-block",
            marginTop: 10,
            padding: "10px 14px",
            border: "1px solid #111",
            borderRadius: 10,
            textDecoration: "none",
          }}
        >
          Åpne chat
        </Link>
      )}

      {msg && (
        <pre
          style={{
            marginTop: 14,
            padding: 12,
            background: "#111",
            color: "#ddd",
            borderRadius: 10,
            fontSize: 12,
          }}
        >
          {msg}
        </pre>
      )}

      {isOwner && (
        <div style={{ marginTop: 24 }}>
          <h2>Interesser</h2>

          {interests.length === 0 ? (
            <p>Ingen interesser ennå.</p>
          ) : (
            interests.map((i) => (
              <div
                key={i.user_id}
                style={{
                  border: "1px solid #333",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{i.user_id}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {fmtDate(i.created_at)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    disabled={busy || isClosed}
                    onClick={() => approveInterest(i.user_id)}
                  >
                    Godkjenn → Chat
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => rejectInterest(i.user_id)}
                  >
                    Fjern
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
