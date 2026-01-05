"use client";

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

  const [meId, setMeId] = useState<string | null>(null);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const hasRows = useMemo(() => rows.length > 0, [rows.length]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setMsg("");

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) {
        if (!alive) return;
        setMsg(userErr.message);
        setLoading(false);
        return;
      }

      if (!user) {
        if (!alive) return;
        router.push("/login");
        return;
      }

      if (!alive) return;
      setMeId(user.id);

      const { data, error } = await supabase
        .from("requests")
        .select(
          "id,user_id,created_at,municipality,location_text,start_time,duration_minutes,level_min,level_max,type,notes,status"
        )
        .eq("user_id", user.id) // ✅ KUN MINE REQUESTS
        .order("created_at", { ascending: false });

      if (!alive) return;

      if (error) {
        setMsg(error.message);
        setRows([]);
      } else {
        setRows((data as RequestRow[]) ?? []);
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mine requests</h1>
          <div className="text-sm opacity-70">
            {meId ? `Innlogget: ${meId}` : ""}
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

      {msg ? (
        <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">
          {msg}
        </div>
      ) : null}

      {/* Content */}
      {loading ? (
        <div className="text-sm opacity-70">Laster…</div>
      ) : !hasRows ? (
        <div className="rounded-xl border p-4">
          <div className="font-medium">Ingen requests enda</div>
          <div className="text-sm opacity-70 mt-1">
            Trykk “Ny request” for å opprette en.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
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
                  <div className="text-sm font-medium">
                    {r.status ?? "—"}
                  </div>
                  <div className="text-xs opacity-60">
                    {fmt(r.created_at)}
                  </div>
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
      )}
    </div>
  );
}
