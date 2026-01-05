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
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [existingMatch, setExistingMatch] = useState<MatchRow | null>(null);

  const [meId, setMeId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [debugClicks, setDebugClicks] = useState(false); // slå på hvis du vil ha alert("klikk")

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setMsg("");

      if (!requestId) {
        setMsg("Mangler request-id i URL.");
        setLoading(false);
        return;
      }

      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) console.warn("auth.getUser error:", userErr);
        if (!alive) return;

        setMeId(user?.id ?? null);

        // 1) request
        const { data: req, error: reqErr } = await supabase
          .from("requests")
          .select("*")
          .eq("id", requestId)
          .maybeSingle();

        if (reqErr) {
          console.error("Fetch request error:", reqErr);
          setMsg(`Kunne ikke hente request: ${reqErr.message}`);
        }
        if (!alive) return;

        setRequest((req as any) ?? null);

        // 2) interests
        const { data: ints, error: intErr } = await supabase
          .from("request_interests")
          .select("request_id,user_id,created_at")
          .eq("request_id", requestId)
          .order("created_at", { ascending: false });

        if (intErr) {
          console.error("Fetch interests error:", intErr);
          setMsg((m) => m || `Kunne ikke hente interesser: ${intErr.message}`);
        }
        if (!alive) return;

        setInterests((ints as any) ?? []);

        // 3) eksisterende match for request (hvis den finnes)
        const { data: m, error: mErr } = await supabase
          .from("matches")
          .select("id,request_id,created_at")
          .eq("request_id", requestId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (mErr) {
          console.warn("Fetch existing match error:", mErr);
          // Ikke blokker UI av dette
        }
        if (!alive) return;

        setExistingMatch((m?.[0] as any) ?? null);
      } catch (e: any) {
        console.error("Load error:", e);
        setMsg(`Uventet feil: ${e?.message ?? String(e)}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [requestId, supabase]);

  const isOwner = useMemo(() => {
    if (!meId || !request?.user_id) return false;
    return meId === request.user_id;
  }, [meId, request?.user_id]);

  async function approveInterest(interestUserId: string) {
    // SUPER tydelig logging for å se hvor det stopper
    console.log("approveInterest() START", { requestId, interestUserId, meId });

    setMsg("");
    setBusy(true);

    try {
      if (!requestId) {
        setMsg("Mangler requestId.");
        console.log("approveInterest() STOP: missing requestId");
        return;
      }
      if (!meId) {
        setMsg("Du må være innlogget.");
        console.log("approveInterest() STOP: missing meId");
        return;
      }

      // Sikkerhetscheck: bare eier skal kunne godkjenne
      if (!isOwner) {
        setMsg("Du er ikke eier av denne requesten.");
        console.log("approveInterest() STOP: not owner");
        return;
      }

      // Hvis match finnes allerede -> åpne den
      if (existingMatch?.id) {
        console.log("approveInterest(): match exists, redirecting", existingMatch.id);
        router.push(`/matches/${existingMatch.id}/chat`);
        return;
      }

      // 1) Lag match
      // NB: Vi antar at matches har minst { request_id }. Hvis du har andre required felter,
      // vil Supabase returnere error – som vi nå viser tydelig.
      const insertPayload: any = {
        request_id: requestId,
      };

      console.log("approveInterest(): inserting match payload", insertPayload);

      const { data: match, error: matchErr } = await supabase
        .from("matches")
        .insert(insertPayload)
        .select("id,request_id,created_at")
        .single();

      if (matchErr) {
        console.error("approveInterest(): INSERT matches error", matchErr);
        setMsg(
          `Kunne ikke opprette match (trolig RLS eller required fields). ` +
            `Feil: ${matchErr.message}`
        );
        return;
      }

      console.log("approveInterest(): match created", match);

      // Oppdater local state så “Åpne chat” blir aktiv umiddelbart
      setExistingMatch(match as any);

      // 2) Redirect til chat
      const matchId = (match as any)?.id;
      if (!matchId) {
        setMsg("Match ble opprettet, men mangler id i respons.");
        console.log("approveInterest(): STOP missing matchId", match);
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
    setMsg("");

    if (!existingMatch?.id) {
      setMsg("Ingen chat/match funnet for denne requesten ennå.");
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
        <div className="text-sm opacity-80">
          Fant ikke request (eller du har ikke tilgang).
        </div>
        {msg ? (
          <div className="rounded-lg border p-3 text-sm">{msg}</div>
        ) : null}
        <Link className="underline text-sm" href="/requests">
          Tilbake til requests
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Topplinje */}
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
              if (debugClicks) alert("klikk: Åpne chat");
              openChat();
            }}
            disabled={busy}
            className="relative z-50 rounded-lg border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
          >
            Åpne chat
          </button>

          <Link
            href="/requests"
            className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
          >
            Tilbake
          </Link>
        </div>
      </div>

      {/* Debug kontroll */}
      <div className="flex items-center gap-2 text-sm">
        <input
          id="debugClicks"
          type="checkbox"
          checked={debugClicks}
          onChange={(e) => setDebugClicks(e.target.checked)}
        />
        <label htmlFor="debugClicks" className="opacity-80">
          Debug: bruk alert() på klikk
        </label>
      </div>

      {msg ? (
        <div className="rounded-lg border p-3 text-sm">
          <div className="font-medium mb-1">Melding</div>
          <div className="opacity-90 whitespace-pre-wrap">{msg}</div>
        </div>
      ) : null}

      {/* Request detaljer */}
      <div className="rounded-xl border p-4 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="opacity-70">Kommune:</span>{" "}
            {request.municipality ?? "-"}
          </div>
          <div>
            <span className="opacity-70">Sted:</span>{" "}
            {request.location_text ?? "-"}
          </div>
          <div>
            <span className="opacity-70">Start:</span> {fmt(request.start_time)}
          </div>
          <div>
            <span className="opacity-70">Varighet:</span>{" "}
            {request.duration_minutes ?? "-"} min
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

      {/* Interesser */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Interesser</h2>

          <div className="text-sm opacity-70">
            {isOwner ? "Du er eier" : "Du er ikke eier"}
            {existingMatch?.id ? ` • Match finnes (${existingMatch.id})` : ""}
          </div>
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
                      onPointerDown={() =>
                        console.log("POINTERDOWN: Godkjenn", i.user_id)
                      }
                      onClick={() => {
                        console.log("CLICK: Godkjenn", i.user_id);
                        if (debugClicks) alert("klikk: Godkjenn");
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

        {/* Ekstra: tydelig knapp som alltid kan teste klikk */}
        <div className="pt-2">
          <button
            type="button"
            onPointerDown={() => console.log("POINTERDOWN: TEST-KNAPP")}
            onClick={() => {
              console.log("CLICK: TEST-KNAPP (skal alltid trigge)");
              alert("TEST: klikk registrert ✅");
            }}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
          >
            TEST: Klikk meg (skal alltid gi alert)
          </button>
        </div>
      </div>
    </div>
  );
}
