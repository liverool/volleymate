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
  request_id: string;
  requester_id: string;
  partner_id: string;
  owner_user_id: string;
  interested_user_id: string;
  created_at: string | null;
  status: string | null;
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
  const [busyDelete, setBusyDelete] = useState(false);

  const [meId, setMeId] = useState<string | null>(null);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [existingMatch, setExistingMatch] = useState<MatchRow | null>(null);

  const [msg, setMsg] = useState<string>("");

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

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) console.warn(userErr);
    setMeId(user?.id ?? null);

    const { data: req, error: reqErr } = await supabase
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr) setMsg(`Kunne ikke hente request: ${reqErr.message}`);
    setRequest((req as any) ?? null);

    const { data: ints, error: intErr } = await supabase
      .from("request_interests")
      .select("request_id,user_id,created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });

    if (intErr) setMsg((m) => m || `Kunne ikke hente interesser: ${intErr.message}`);
    setInterests((ints as any) ?? []);

    const { data: m, error: mErr } = await supabase
      .from("matches")
      .select("id,request_id,requester_id,partner_id,owner_user_id,interested_user_id,created_at,status")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (mErr) {
      // Ikke stopp siden – match kan være RLS-protected for noen
    }
    setExistingMatch((m?.[0] as any) ?? null);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function approveInterest(interestUserId: string) {
    setMsg("");
    setBusy(true);

    try {
      if (!requestId) return setMsg("Mangler requestId.");
      if (!meId) return setMsg("Du må være innlogget.");
      if (!request) return setMsg("Request ikke lastet.");
      if (!isOwner) return setMsg("Du er ikke eier av denne requesten.");

      // Finnes match allerede? åpne chat
      if (existingMatch?.id) {
        router.push(`/matches/${existingMatch.id}/chat`);
        return;
      }

      const insertPayload: any = {
        request_id: requestId,
        requester_id: meId,
        partner_id: interestUserId,
        owner_user_id: meId,
        interested_user_id: interestUserId, // ✅ required
        // status har default
      };

      const { data: match, error: matchErr } = await supabase
        .from("matches")
        .insert(insertPayload)
        .select("id,request_id,requester_id,partner_id,owner_user_id,interested_user_id,created_at,status")
        .single();

      if (matchErr) {
        setMsg(
          `Kunne ikke opprette match. Feil: ${matchErr.message}` +
            (matchErr.details ? `\nDetails: ${matchErr.details}` : "")
        );
        return;
      }

      setExistingMatch(match as any);
      router.push(`/matches/${(match as any).id}/chat`);
    } finally {
      setBusy(false);
    }
  }

  function openChat() {
    setMsg("");
    if (!existingMatch?.id) return setMsg("Ingen chat/match finnes for denne requesten ennå.");
    router.push(`/matches/${existingMatch.id}/chat`);
  }

  async function deleteRequest() {
    setMsg("");
    if (!request?.id) return;
    if (!meId) return setMsg("Du må være innlogget.");
    if (!isOwner) return setMsg("Du er ikke eier av denne requesten.");

    // ✅ Valgfritt, men trygt: ikke slett hvis match finnes
    if (existingMatch?.id) {
      return setMsg("Denne requesten har allerede en match/chat. Sletting er blokkert for å unngå å ødelegge flyten.");
    }

    const ok = confirm("Er du sikker på at du vil slette denne requesten?");
    if (!ok) return;

    setBusyDelete(true);
    try {
      const { error } = await supabase.from("requests").delete().eq("id", request.id);

      if (error) {
        setMsg(`Kunne ikke slette request: ${error.message}`);
        return;
      }

      router.push("/requests");
      router.refresh();
    } finally {
      setBusyDelete(false);
    }
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Request</h1>
          <div className="text-sm opacity-70">
            Opprettet: {fmt(request.created_at)} • Status: {request.status ?? "-"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* ✅ SLETT: kun eier */}
          {isOwner ? (
            <button
              type="button"
              onClick={deleteRequest}
              disabled={busy || busyDelete}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              title={existingMatch?.id ? "Kan ikke slette når match/chat finnes" : "Slett request"}
            >
              {busyDelete ? "Sletter…" : "Slett"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={openChat}
            disabled={busy}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
          >
            Åpne chat
          </button>

          <Link href="/requests" className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5">
            Tilbake
          </Link>
        </div>
      </div>

      {msg ? (
        <div className="rounded-lg border p-3 text-sm">
          <div className="font-medium mb-1">Melding</div>
          <div className="opacity-90 whitespace-pre-wrap">{msg}</div>
        </div>
      ) : null}

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
                      onClick={() => approveInterest(i.user_id)}
                      disabled={busy}
                      className="rounded-lg bg-black text-white px-3 py-2 text-sm hover:opacity-90 disabled:opacity-50"
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
      </div>
    </div>
  );
}
