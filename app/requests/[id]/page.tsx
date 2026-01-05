"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

type MatchRow = {
  id: string;
  request_id: string | null;
  requester_id: string | null;
  created_at: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("no-NO");
  } catch {
    return iso ?? "";
  }
}

export default function RequestDetailsPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const requestId = useMemo(() => {
    const raw = (params as any)?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [meId, setMeId] = useState<string | null>(null);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [existingMatch, setExistingMatch] = useState<MatchRow | null>(null);

  const [msg, setMsg] = useState<string>("");
  const [debugAlerts, setDebugAlerts] = useState(false);

  const isOwner = useMemo(() => {
    if (!meId || !request?.user_id) return false;
    return meId === request.user_id;
  }, [meId, request?.user_id]);

  async function loadAll() {
    setLoading(true);
    setMsg("");

    if (!requestId) {
      setMsg("Mangler request-id i URL.");
      setLoading(false);
      return;
    }

    // 1) hvem er jeg
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) console.warn("auth.getUser error:", userErr);
    setMeId(user?.id ?? null);

    // 2) hent request
    const { data: req, error: reqErr } = await supabase
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr) {
      console.error("Fetch request error:", reqErr);
      setMsg(`Kunne ikke hente request: ${reqErr.message}`);
    }

    setRequest((req as any) ?? null);

    // 3) hent interesser
    const { data: ints, error: intErr } = await supabase
      .from("request_interests")
      .select("request_id,user_id,created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });

    if (intErr) {
      console.error("Fetch interests error:", intErr);
      setMsg((m) => m || `Kunne ikke hente interesser: ${intErr.message}`);
    }

    setInterests((ints as any) ?? []);

    // 4) hent eksisterende match (hvis finnes)
    const { data: m, error: mErr } = await supabase
      .from("matches")
      .select("id,request_id,requester_id,created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (mErr) {
      console.warn("Fetch existing match error:", mErr);
      // ikke blokker siden
    }

    setExistingMatch((m?.[0] as any) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await loadAll();
      } catch (e: any) {
        if (!alive) return;
        console.error("Load error:", e);
        setMsg(`Uventet feil: ${e?.message ?? String(e)}`);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function approveInterest(interestUserId: string) {
    console.log("approveInterest() START", { requestId, interestUserId, meId });
    if (debugAlerts) alert("KLIKK: Godkjenn");

    setMsg("");
    setBusy(true);

    try {
      if (!requestId) {
        setMsg("Mangler requestId.");
        return;
      }
      if (!meId) {
        setMsg("Du må være innlogget.");
        return;
      }
      if (!request) {
        setMsg("Request ikke lastet.");
        return;
      }
      if (!isOwner) {
        setMsg("Du er ikke eier av denne requesten.");
        return;
      }

      // Hvis match finnes allerede: gå direkte til chat
      if (existingMatch?.id) {
        console.log("approveInterest(): match exists -> redirect", existingMatch.id);
        router.push(`/matches/${existingMatch.id}/chat`);
        return;
      }

      // INSERT: matches krever requester_id (NOT NULL)
      // requester_id = eier (deg), dvs auth.uid()
      // request_id = requestId
      const insertPayload: any = {
        request_id: requestId,
        requester_id: meId,
      };

      console.log("approveInterest(): inserting matches payload", insertPayload);

      const { data: match, error: matchErr } = await supabase
        .from("matches")
        .insert(insertPayload)
        .select("id,request_id,requester_id,created_at")
        .single();

      if (matchErr) {
        console.error("approveInterest(): INSERT matches error", matchErr);
        setMsg(
          `Kunne ikke opprette match. ` +
            `Feil: ${matchErr.message}` +
            (matchErr.details ? `\nDetails: ${matchErr.details}` : "")
        );
        return;
      }

      console.log("approveInterest(): match created", match);
      setExistingMatch(match as any);

      const matchId = (match as any)?.id;
      if (!matchId) {
        setMsg("Match ble opprettet, men mangler id i respons.");
        return;
      }

      console.log("approveInterest(): redirect ->", `/matches/${matchId}/chat`);
      router.push(`/matches/${matchId}/chat`);
    } catch (e: any) {
      console.error("approveInterest() exception:", e);
      setMsg(`Uventet feil i approve: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
      console.log("approveInterest() END");
    }
  }

  function openChat() {
    console.log("openChat() clicked", { existingMatchId: existingMatch?.id });
    if (debugAlerts) alert("KLIKK: Åpne chat");

    setMsg("");
    if (!existingMatch?.id) {
      setMsg("Ingen chat/match finnes for denne requesten ennå.");
      return;
    }
    router.push(`/matches/${existingMatch.id}/chat`);
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm opacity-70">Laster…</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Request</h1>
        <div className="text-sm opacity-80">Fant ikke request (eller ingen tilgang).</div>

        {msg ? <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{msg}</div> : null}

        <Link className="underline text-sm" href="/requests">
          Tilbake til requests
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Request</h1>
          <div className="text-sm opacity-70">
            Opprettet: {fmt(request.created_at)} • Status: {request.status ?? "-"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={() => console.log("POINTERDOWN: Åpne chat")}
            onClick={() => {
              console.log("CLICK: Åpne chat");
              openChat();
            }}
            disabled={busy}
            className="relative z-50 rounded-lg border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
          >
            Åpne chat
          </button>

          <Link href="/requests" className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5">
            Tilbake
          </Link>
        </div>
      </div>

      {/* Debug */}
      <div className="flex items-center gap-2 text-sm">
        <input
          id="debugAlerts"
          type="checkbox"
          checked={debugAlerts}
          onChange={(e) => setDebugAlerts(e.target.checked)}
        />
        <label htmlFor="debugAlerts" className="opacity-80">
          Debug: alert() på klikk
        </label>
        <span className="opacity-60">• eier: {String(isOwner)}</span>
        <span className="opacity-60">• match: {existingMatch?.id ? existingMatch.id : "ingen"}</span>
      </div>

      {msg ? (
        <div className="rounded-lg border p-3 text-sm">
          <div className="font-medium mb-1">Melding</div>
          <div className="opacity-90 whitespace-pre-wrap">{msg}</div>
        </div>
      ) : null}

      {/* Request details */}
      <div className="rounded-xl border p-4 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="opacity-70">Kommune:</span> {request.municipality ?? "-"}
          </div>
          <div>
            <span className="opacity-70">Sted:</span> {request.location_text ?? "-"}
          </div>
          <div>
            <span className="opacity-70">Start:</span> {fmt(request.start_time)}
          </div>
          <div>
            <span className="opacity-70">Varighet:</span> {request.duration_minutes ?? "-"} min
          </div>
          <div>
            <span className="opacity-70">Nivå:</span>{" "}
            {(request.level_min ?? "-") + " – " + (request.level_max ?? "-")}
          </div>
          <div>
            <span className="opacity-70">Type:</span> {request.type ?? "-"}
          </div>
        </div>

        {request.notes ? (
          <div className="pt-2 text-sm">
            <div className="opacity-70">Notater</div>
            <div className="whitespace-pre-wrap">{request.notes}</div>
          </div>
        ) : null}
      </div>

      {/* Interests */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Interesser</h2>
          <div className="text-sm opacity-70">{isOwner ? "Du er eier" : "Kun eier kan godkjenne"}</div>
        </div>

        {interests.length === 0 ? (
          <div className="text-sm opacity-70">Ingen interesser enda.</div>
        ) : (
          <div className="space-y-2">
            {interests.map((i) => (
              <div
                key={`${i.request_id}:${i.user_id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="text-sm">
                  <div className="font-medium">User: {i.user_id}</div>
                  <div className="opacity-70">Tid: {fmt(i.created_at)}</div>
                </div>

                <div className="flex items-center gap-2">
                  {isOwner ? (
                    <button
                      type="button"
                      onPointerDown={() => console.log("POINTERDOWN: Godkjenn", i.user_id)}
                      onClick={() => {
                        console.log("CLICK: Godkjenn", i.user_id);
                        approveInterest(i.user_id);
                      }}
                      disabled={busy}
                      className="relative z-50 rounded-lg bg-black text-white px-3 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      Godkjenn → Chat
                    </button>
                  ) : (
                    <div className="text-xs opacity-70">Kun eier kan godkjenne</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Test-knapp */}
        <div className="pt-2">
          <button
            type="button"
            onPointerDown={() => console.log("POINTERDOWN: TEST")}
            onClick={() => {
              console.log("CLICK: TEST (skal alltid trigge)");
              alert("TEST: klikk registrert ✅");
            }}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
          >
            TEST: Klikk meg
          </button>
        </div>
      </div>
    </div>
  );
}
