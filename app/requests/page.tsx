"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type ProfileMini = {
  user_id: string;
  display_name: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("no-NO");
  } catch {
    return iso ?? "";
  }
}

function shortId(id: string | null | undefined) {
  if (!id) return "-";
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function RequestsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tab, setTab] = useState<"open" | "mine">("open");
  const [meId, setMeId] = useState<string | null>(null);

  const [openRows, setOpenRows] = useState<RequestRow[]>([]);
  const [myRows, setMyRows] = useState<RequestRow[]>([]);

  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const hasOpen = useMemo(() => openRows.length > 0, [openRows.length]);
  const hasMine = useMemo(() => myRows.length > 0, [myRows.length]);

  function setTabAndUrl(next: "open" | "mine") {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }

  async function loadProfilesForUserIds(userIds: string[]) {
    if (userIds.length === 0) return;

    const uniq = Array.from(new Set(userIds.filter(Boolean)));
    const batches = chunk(uniq, 100);

    const merged: Record<string, string> = {};

    for (const ids of batches) {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,display_name")
        .in("user_id", ids);

      if (error) {
        setMsg((m) => m || `Kunne ikke hente navn (profiles): ${error.message}`);
        continue;
      }

      const rows = (data as ProfileMini[]) ?? [];
      for (const p of rows) {
        const name = (p.display_name ?? "").trim();
        if (p.user_id && name) merged[p.user_id] = name;
      }
    }

    setNameByUserId((prev) => ({ ...prev, ...merged }));
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

    const baseSelect =
      "id,user_id,created_at,municipality,location_text,start_time,duration_minutes,level_min,level_max,type,notes,status";

    // Mine
    const mineRes = await supabase
      .from("requests")
      .select(baseSelect)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    let mineRows: RequestRow[] = [];
    if (mineRes.error) {
      setMsg((m) => m || `Mine requests: ${mineRes.error!.message}`);
      setMyRows([]);
    } else {
      mineRows = (mineRes.data as RequestRow[]) ?? [];
      setMyRows(mineRows);
    }

    // Åpne
    const openRes = await supabase
      .from("requests")
      .select(baseSelect)
      .neq("user_id", user.id)
      .order("created_at", { ascending: false });

    let openFiltered: RequestRow[] = [];
    if (openRes.error) {
      setMsg((m) => m || `Åpne requests: ${openRes.error!.message}`);
      setOpenRows([]);
    } else {
      openFiltered = ((openRes.data as RequestRow[]) ?? []).filter((r) => {
        const s = (r.status ?? "").toLowerCase();
        return s !== "done" && s !== "cancelled";
      });
      setOpenRows(openFiltered);
    }

    const idsToFetch = [
      ...openFiltered.map((r) => r.user_id || ""),
      ...mineRows.map((r) => r.user_id || ""),
    ];
    await loadProfilesForUserIds(idsToFetch);

    setLoading(false);
  }

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get("tab");
      if (t === "mine") setTab("mine");
      else setTab("open");
    } catch {
      // ignore
    }

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

    const { error } = await supabase.from("requests").delete().eq("id", id).eq("user_id", meId);

    if (error) {
      setMsg(`Kunne ikke slette: ${error.message}`);
      setBusyId(null);
      return;
    }

    setMyRows((prev) => prev.filter((r) => r.id !== id));
    setBusyId(null);
  }

  function ownerLabel(userId: string | null) {
    if (!userId) return "Ukjent";
    if (meId && userId === meId) return "DEG";
    return nameByUserId[userId] ?? shortId(userId);
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Requests</h1>
          <div className="text-sm opacity-70">Åpne = meld interesse • Mine = administrer dine</div>
        </div>

        <Link
          href="/requests/new"
          className="w-full sm:w-auto text-center rounded-lg bg-black text-white px-3 py-2 text-sm hover:opacity-90"
        >
          Ny request
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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

      {msg ? <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{msg}</div> : null}

      {loading ? (
        <div className="text-sm opacity-70">Laster…</div>
      ) : tab === "open" ? (
        !hasOpen ? (
          <div className="rounded-xl border p-4">
            <div className="font-medium">Ingen åpne requests</div>
            <div className="text-sm opacity-70 mt-1">Prøv igjen senere.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {openRows.map((r) => (
              <Link
                key={r.id}
                href={`/requests/${r.id}`}
                className="block rounded-xl border p-4 hover:bg-black/5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold truncate">
                      {r.municipality ?? "Ukjent kommune"}
                      {r.location_text ? ` • ${r.location_text}` : ""}
                    </div>

                    <div className="text-sm opacity-70">Opprettet av: {ownerLabel(r.user_id)}</div>

                    <div className="text-sm opacity-70">
                      Start: {fmt(r.start_time) || "-"} • Varighet: {r.duration_minutes ?? "-"} min
                    </div>
                    <div className="text-sm opacity-70">
                      Nivå: {(r.level_min ?? "-") + " – " + (r.level_max ?? "-")} • Type:{" "}
                      {r.type ?? "-"}
                    </div>
                  </div>

                  <div className="sm:text-right flex sm:block items-center justify-between sm:justify-end gap-3">
                    <div className="text-sm font-medium">{r.status ?? "—"}</div>
                    <div className="text-xs opacity-60">{fmt(r.created_at)}</div>
                  </div>
                </div>

                {r.notes ? (
                  <div className="text-sm opacity-80 mt-3 line-clamp-3 break-words">{r.notes}</div>
                ) : null}
              </Link>
            ))}
          </div>
        )
      ) : !hasMine ? (
        <div className="rounded-xl border p-4">
          <div className="font-medium">Du har ingen requests</div>
          <div className="text-sm opacity-70 mt-1">Trykk “Ny request”.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {myRows.map((r) => (
            <div key={r.id} className="rounded-xl border hover:bg-black/5">
              <Link href={`/requests/${r.id}`} className="block p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold truncate">
                      {r.municipality ?? "Ukjent kommune"}
                      {r.location_text ? ` • ${r.location_text}` : ""}
                    </div>

                    <div className="text-sm opacity-70">Opprettet av: DEG</div>

                    <div className="text-sm opacity-70">
                      Start: {fmt(r.start_time) || "-"} • Varighet: {r.duration_minutes ?? "-"} min
                    </div>
                    <div className="text-sm opacity-70">
                      Nivå: {(r.level_min ?? "-") + " – " + (r.level_max ?? "-")} • Type:{" "}
                      {r.type ?? "-"}
                    </div>
                  </div>

                  <div className="sm:text-right flex sm:block items-center justify-between sm:justify-end gap-3">
                    <div className="text-sm font-medium">{r.status ?? "—"}</div>
                    <div className="text-xs opacity-60">{fmt(r.created_at)}</div>
                  </div>
                </div>

                {r.notes ? (
                  <div className="text-sm opacity-80 mt-3 line-clamp-3 break-words">{r.notes}</div>
                ) : null}
              </Link>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 pb-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/requests/${r.id}`);
                  }}
                  className="w-full sm:w-auto rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
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
                  className="w-full sm:w-auto rounded-lg border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
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
