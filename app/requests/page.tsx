"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function fmt(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("no-NO");
  } catch {
    return iso ?? "";
  }
}

export default function RequestsPage() {
  const supabase = createClient();
  const router = useRouter();
  const sp = useSearchParams();

  // tab=open | mine
  const initialTab = (sp.get("tab") as "open" | "mine") ?? "open";
  const [tab, setTab] = useState<"open" | "mine">(
    initialTab === "mine" ? "mine" : "open"
  );

  const [meId, setMeId] = useState<string | null>(null);

  const [openRows, setOpenRows] = useState<RequestRow[]>([]);
  const [myRows, setMyRows] = useState<RequestRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const hasOpen = useMemo(() => openRows.length > 0, [openRows.length]);
  const hasMine = useMemo(() => myRows.length > 0, [myRows.length]);

  function setTabAndUrl(next: "open" | "mine") {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url.toString());
  }

  async function loadAll() {
    setLoading(true);
    setMsg("");

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      setMsg(userErr.message);
      setLoading(false);
      return;
    }

    if (!user) {
      router.push("/login");
      return;
    }

    setMeId(user.id);

    // Hent "mine"
    const mineRes = await supabase
      .from("requests")
      .select(
        "id,user_id,created_at,municipality,location_text,start_time,duration_minutes,level_min,level_max,type,notes,status"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (mineRes.error) {
      setMsg((m) => m || mineRes.error!.message);
      setMyRows([]);
    } else {
      setMyRows((mineRes.data as RequestRow[]) ?? []);
    }

    // Hent "åpne" (ikke mine)
    // Filter: ekskluder done/cancelled (tilpass hvis du har andre status-verdier)
    const openRes = await supabase
      .from("requests")
      .select(
        "id,user_id,created_at,municipality,location_text,start_time,duration_minutes,level_min,level_max,type,notes,status"
      )
      .neq("user_id", user.id)
      .not("status", "in", '("done","cancelled")')
      .order("created_at", { ascending: false });

    if (openRes.error) {
      setMsg((m) => m || openRes.error!.message);
      setOpenRows([]);
    } else {
      setOpenRows((openRes.data as RequestRow[]) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deleteRequest(id: string) {
    if (!meId) {
      setMsg("Du må være innlogget.");
      return;
    }

    const ok = confirm("Slette denne requesten? Dette kan ikke angres.");
    if (!ok) return;

    setMsg("");
    setBusyId(id);

    // ekstra sikkerhet: id + user_id
    const { error } = await supabase
      .from("requests")
      .delete()
      .eq("id", id)
      .eq("user_id", meId);

    if (error) {
      setMsg(`Kunne ikke slette: ${error.message}`);
      setBusyId(null);
      return;
    }

    setMyRows((prev) => prev.filter((r) => r.id !== id));
    setBusyId(null);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Requests</h1>
          <div className="text-sm opacity-70">
            Åpne = meld interesse • Mine = administrer dine
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/requests/new"
            className="rounded-lg bg-black text-white px-3 py-2 text-sm hover:opacity-90"
          >
            Ny request
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTabAndUrl("open")}
          className={`rounded-lg border px-3 py-2 text-sm ${
            tab === "open" ? "bg-black text-white border-black" : "hover:bg-black/5"
          }`}
        >
          Åpne ({openRows.length})
        </button>
        <button
          type="button"
          onClick={() => setTabAndUrl("mine")}
          className={`rounded-lg border px-3 py-2 text-sm ${
            tab === "mine" ? "bg-black text-white border-black" : "hover:bg-black/5"
          }`}
        >
          Mine ({myRows.length})
        </button>
      </div>

      {msg ? (
        <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">
          {msg}
        </div>
      ) : null}

      {/* Content */}
      {loading ? (
        <div className="text-sm opacity-70">Laster…</div>
      ) : tab === "open" ? (
        !hasOpen ? (
          <div className="rounded-xl border p-4">
            <div className="font-medium">Ingen åpne requests</div>
            <div className="text-sm opacity-70 mt-1">
              Prøv igjen senere, eller opprett en ny.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {openRows.map((r) => (
              <Link
                key={r.id}
                href={`/requests/${r.id}`}
                className="block rounded-xl border p-4 hover:bg-black/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {r.municipality ?? "Ukjent kommune"}
                      {r.location_text ? ` • ${r.location_text}` : ""}
                    </div>
                    <div className="text-sm opacity-70">
                      Start: {fmt(r.start_time) || "-"} • Varighet:{" "}
                      {r.duration_minutes ?? "-"} min
                    </div>
                    <div className="text-sm opacity-70">
                      Nivå: {(r.level_min ?? "-") + " – " + (r.level_max ?? "-")} •
                      Type: {r.type ?? "-"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-medium">{r.status ?? "—"}</div>
                    <div className="text-xs opacity-60">{fmt(r.created_at)}</div>
                  </div>
                </div>

                {r.notes ? (
                  <div className="text-sm opacity-80 mt-3 line-clamp-2">
                    {r.notes}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )
      ) : !hasMine ? (
        <div className="rounded-xl border p-4">
          <div className="font-medium">Du har ingen requests</div>
          <div className="text-sm opacity-70 mt-1">
            Trykk “Ny request” for å opprette en.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {myRows.map((r) => (
            <div key={r.id} className="rounded-xl border hover:bg-black/5">
              <Link href={`/requests/${r.id}`} className="block p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {r.municipality ?? "Ukjent kommune"}
                      {r.location_text ? ` • ${r.location_text}` : ""}
                    </div>
                    <div className="text-sm opacity-70">
                      Start: {fmt(r.start_time) || "-"} • Varighet:{" "}
                      {r.duration_minutes ?? "-"} min
                    </div>
                    <div className="text-sm opacity-70">
                      Nivå: {(r.level_min ?? "-") + " – " + (r.level_max ?? "-")} •
                      Type: {r.type ?? "-"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-medium">{r.status ?? "—"}</div>
                    <div className="text-xs opacity-60">{fmt(r.created_at)}</div>
                  </div>
                </div>

                {r.notes ? (
                  <div className="text-sm opacity-80 mt-3 line-clamp-2">
                    {r.notes}
                  </div>
                ) : null}
              </Link>

              <div className="flex items-center justify-end gap-2 px-4 pb-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/requests/${r.id}`);
                  }}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
                >
                  Åpne
                </button>

                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteRequest(r.id);
                  }}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
                >
                  {busyId === r.id ? "Sletter…" : "Slett"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
