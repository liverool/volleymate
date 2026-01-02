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

function fmtDate(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("no-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso ?? "";
  }
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
  const [msg, setMsg] = useState<string>("");

  const [userId, setUserId] = useState<string | null>(null);
  const [row, setRow] = useState<RequestRow | null>(null);

  const [interestCount, setInterestCount] = useState<number>(0);
  const [iAmInterested, setIAmInterested] = useState<boolean>(false);

  const isOwner = !!userId && !!row?.user_id && userId === row.user_id;

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setMsg("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setUserId(uid);

    // 1) Load request
    const { data: req, error: reqErr } = await supabase
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
        status
      `
      )
      .eq("id", id)
      .single();

    if (reqErr) {
      setRow(null);
      setLoading(false);
      setMsg(`Kunne ikke laste request: ${reqErr.message}`);
      return;
    }

    setRow(req as RequestRow);

    // 2) Load interest count
    // (Hvis tabellen heter noe annet hos deg, si ifra så retter jeg)
    const { count, error: countErr } = await supabase
      .from("request_interests")
      .select("*", { count: "exact", head: true })
      .eq("request_id", id);

    if (!countErr) setInterestCount(count ?? 0);

    // 3) Check if current user is interested
    if (uid) {
      const { data: mine, error: mineErr } = await supabase
        .from("request_interests")
        .select("id")
        .eq("request_id", id)
        .eq("user_id", uid)
        .maybeSingle();

      setIAmInterested(!mineErr && !!mine);
    } else {
      setIAmInterested(false);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addInterest() {
    if (!userId) {
      router.push("/login");
      return;
    }
    if (!id) return;

    setBusy(true);
    setMsg("");

    // Insert interest (ofte trigger dette match-opprettelse hos deg)
    const { error } = await supabase.from("request_interests").insert({
      request_id: id,
      user_id: userId,
    });

    if (error) {
      setMsg(`Kunne ikke lagre interesse: ${error.message}`);
      setBusy(false);
      return;
    }

    await loadAll();
    setMsg("Interesse lagret.");
    setBusy(false);
  }

  async function removeInterest() {
    if (!userId || !id) return;

    setBusy(true);
    setMsg("");

    // Delete interest (ofte trigger dette dematch hos deg)
    const { error } = await supabase
      .from("request_interests")
      .delete()
      .eq("request_id", id)
      .eq("user_id", userId);

    if (error) {
      setMsg(`Kunne ikke trekke interesse: ${error.message}`);
      setBusy(false);
      return;
    }

    await loadAll();
    setMsg("Interesse fjernet.");
    setBusy(false);
  }

  async function closeRequest() {
    if (!isOwner || !id) return;

    setBusy(true);
    setMsg("");

    const { error } = await supabase
      .from("requests")
      .update({ status: "closed" })
      .eq("id", id);

    if (error) {
      setMsg(`Kunne ikke lukke request: ${error.message}`);
      setBusy(false);
      return;
    }

    await loadAll();
    setMsg("Request lukket.");
    setBusy(false);
  }

  // Best effort: prøver å slette relaterte rader først (FK-trøbbel)
  async function cleanupChildrenBeforeDelete(requestId: string) {
    // 1) request_interests
    await supabase.from("request_interests").delete().eq("request_id", requestId);

    // 2) matches + match_reads (hvis du har disse tabellene)
    // Vi prøver – hvis tabell ikke finnes eller RLS stopper det, ignorerer vi.
    try {
      const { data: matches } = await supabase
        .from("matches")
        .select("id")
        .eq("request_id", requestId);

      const matchIds = (matches ?? []).map((m: any) => m.id).filter(Boolean);

      if (matchIds.length > 0) {
        // match_reads (hvis eksisterer)
        await supabase.from("match_reads").delete().in("match_id", matchIds);
      }

      // slett matches
      await supabase.from("matches").delete().eq("request_id", requestId);
    } catch {
      // ignore
    }
  }

  async function deleteRequest() {
    if (!isOwner || !id) return;

    const ok = confirm("Slette denne forespørselen permanent?");
    if (!ok) return;

    setBusy(true);
    setMsg("");

    // Første forsøk
    let { error } = await supabase.from("requests").delete().eq("id", id);

    // Hvis FK stopper (eller annen server-feil), prøv å rydde barn og forsøk igjen
    if (error) {
      await cleanupChildrenBeforeDelete(id);
      const retry = await supabase.from("requests").delete().eq("id", id);
      error = retry.error ?? null;
    }

    if (error) {
      setMsg(
        `Kunne ikke slette. Hvis feilen handler om "foreign key", må vi legge inn ON DELETE CASCADE eller utvide cleanup.\n\n${error.message}`
      );
      setBusy(false);
      return;
    }

    router.push("/requests");
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
        Laster…
      </div>
    );
  }

  if (!row) {
    return (
      <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
        <p>Request ikke funnet.</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/requests">← Tilbake</Link>
        </p>
        {msg ? <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre> : null}
      </div>
    );
  }

  const isClosed = row.status === "closed" || row.status === "done";

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <p style={{ marginBottom: 10 }}>
        <Link href="/requests">← Tilbake</Link>
      </p>

      <h1 style={{ fontSize: 32, marginBottom: 10 }}>Request</h1>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <strong>{row.municipality ?? "Ukjent kommune"}</strong>
        </div>

        {row.location_text ? (
          <div style={{ marginBottom: 8 }}>{row.location_text}</div>
        ) : null}

        {row.start_time ? (
          <div style={{ marginBottom: 8, opacity: 0.8 }}>
            {fmtDate(row.start_time)}
            {row.duration_minutes ? ` • ${row.duration_minutes} min` : ""}
          </div>
        ) : null}

        {(row.level_min != null || row.level_max != null) && (
          <div style={{ marginBottom: 8, opacity: 0.85 }}>
            Nivå: {row.level_min ?? "?"} – {row.level_max ?? "?"}
          </div>
        )}

        {row.type ? (
          <div style={{ marginBottom: 8, opacity: 0.85 }}>Type: {row.type}</div>
        ) : null}

        {row.notes ? (
          <div style={{ marginBottom: 8 }}>
            <strong>Notater:</strong>
            <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{row.notes}</div>
          </div>
        ) : null}

        <div style={{ opacity: 0.8 }}>
          Status: <strong>{row.status ?? "?"}</strong> • Interessert:{" "}
          <strong>{interestCount}</strong>
        </div>
      </div>

      {msg ? (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#111",
            color: "#ddd",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #333",
            marginBottom: 14,
            fontSize: 12,
          }}
        >
          {msg}
        </pre>
      ) : null}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {!userId ? (
          <Link
            href="/login"
            style={{
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: 10,
              textDecoration: "none",
            }}
          >
            Logg inn for å melde interesse
          </Link>
        ) : isClosed ? (
          <span style={{ opacity: 0.7 }}>Denne requesten er lukket.</span>
        ) : iAmInterested ? (
          <button
            disabled={busy}
            onClick={removeInterest}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #999",
              background: "transparent",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Jobber…" : "Trekk interesse"}
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={addInterest}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Jobber…" : "Jeg kan spille"}
          </button>
        )}

        {isOwner && (
          <>
            {!isClosed && (
              <button
                disabled={busy}
                onClick={closeRequest}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #666",
                  background: "transparent",
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy ? "Jobber…" : "Lukk request"}
              </button>
            )}

            <button
              disabled={busy}
              onClick={deleteRequest}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #c00",
                background: "transparent",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Sletter…" : "Slett request"}
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: 18, opacity: 0.7, fontSize: 12 }}>
        Tips: Hvis slett feiler pga “foreign key”, si hva feilmeldingen er, så
        lager jeg riktig ON DELETE CASCADE eller utvider cleanup-lista.
      </div>
    </div>
  );
}
