"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type SessionType = "moro" | "trening" | "turnering";

export default function NewRequestPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [uiMsg, setUiMsg] = useState("");
  const [debug, setDebug] = useState("");
  const [authInfo, setAuthInfo] = useState<string>("");

  const [municipality, setMunicipality] = useState("Modum");
  const [locationText, setLocationText] = useState("");

  // Bruker input type="datetime-local" (best), men vi tåler tom tid ved å auto-fylle.
  const [startTime, setStartTime] = useState("");

  const [durationMinutes, setDurationMinutes] = useState(90);
  const [levelMin, setLevelMin] = useState(1);
  const [levelMax, setLevelMax] = useState(10);
  const [type, setType] = useState<SessionType>("moro");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);

  function setDbg(step: string, extra?: any) {
    const text =
      `[${new Date().toLocaleTimeString("nb-NO")}] ${step}` +
      (extra !== undefined ? `\n${JSON.stringify(extra, null, 2)}` : "");
    console.log(text);
    setDebug(text);
  }

  async function getUserOrRedirect() {
    setDbg("auth: getUser()");
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      setDbg("auth: ERROR", error);
      setUiMsg("Auth-feil: " + error.message);
      return null;
    }

    if (!data?.user) {
      setDbg("auth: NO USER -> redirect /login");
      setUiMsg("Du er ikke innlogget (sendes til login).");
      router.push("/login");
      return null;
    }

    setDbg("auth: OK", { userId: data.user.id, email: data.user.email });
    setAuthInfo(`${data.user.email ?? ""} (${data.user.id})`);
    return data.user;
  }

  // Hvis startTime mangler -> sett en fornuftig default
  function coerceStartTimeToISO(input: string) {
    // input fra datetime-local er typisk "YYYY-MM-DDTHH:mm"
    // Hvis input er tom -> return null
    if (!input) return null;

    // Hvis user somehow gir bare dato "YYYY-MM-DD" -> legg på default "T18:00"
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const fixed = `${input}T18:00`;
      return new Date(fixed).toISOString();
    }

    // Hvis user gir "YYYY-MM-DDTHH:mm" -> ok
    // Hvis user gir "YYYY-MM-DDT" eller lignende -> fallback
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) {
      return new Date(input).toISOString();
    }

    // Fallback: prøv parse, hvis ikke -> null
    const d = new Date(input);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  useEffect(() => {
    (async () => {
      setDbg("page: mount");
      await getUserOrRedirect();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createRequest() {
    setUiMsg("");
    setDbg("createRequest: clicked");

    const user = await getUserOrRedirect();
    if (!user) {
      setDbg("createRequest: stop (no user)");
      return;
    }

    if (!locationText.trim()) {
      setDbg("createRequest: stop (locationText empty)");
      setUiMsg("Skriv et sted (f.eks. RVS-parken).");
      return;
    }

    // Hvis startTime er tom: sett default til i dag kl 18:00
    let startISO = coerceStartTimeToISO(startTime);
    if (!startISO) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      const fixed = `${y}-${m}-${d}T18:00`;
      startISO = new Date(fixed).toISOString();
      setDbg("createRequest: startTime missing -> default 18:00", { fixed, startISO });
    }

    if (levelMin > levelMax) {
      setDbg("createRequest: stop (levelMin > levelMax)", { levelMin, levelMax });
      setUiMsg("level_min kan ikke være høyere enn level_max.");
      return;
    }

    setSaving(true);
    setDbg("createRequest: saving=true");

    try {
      const payload = {
        user_id: user.id,
        municipality: municipality.trim(),
        location_text: locationText.trim(),
        start_time: startISO,
        duration_minutes: Number(durationMinutes),
        level_min: Number(levelMin),
        level_max: Number(levelMax),
        type,
        notes: notes.trim() ? notes.trim() : null,
        status: "open",
      };

      setDbg("createRequest: insert payload", payload);

      const { data, error } = await supabase
        .from("requests")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        setDbg("createRequest: INSERT ERROR", error);
        setUiMsg(error.message);
        return;
      }

      setDbg("createRequest: INSERT OK", data);
      setUiMsg("Opprettet ✅");
      router.push(`/requests/${data.id}`);
    } catch (e: any) {
      setDbg("createRequest: EXCEPTION", { message: e?.message, e });
      setUiMsg(e?.message ?? "Ukjent feil");
    } finally {
      setSaving(false);
      setDbg("createRequest: saving=false");
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Laster…</div>;

  return (
    <div style={{ maxWidth: 920, margin: "30px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Ny forespørsel</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/requests"><button style={{ padding: "10px 14px" }}>← Requests</button></Link>
          <Link href="/matches"><button style={{ padding: "10px 14px" }}>Matches</button></Link>
        </div>
      </div>

      {authInfo ? (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Innlogget som: {authInfo}
        </div>
      ) : null}

      {uiMsg ? (
        <div style={{ marginTop: 12, padding: 10, border: "1px solid #ddd", borderRadius: 10 }}>
          {uiMsg}
        </div>
      ) : null}

      <div style={{ marginTop: 14, border: "1px solid #ddd", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
        <label>
          Kommune
          <input
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Sted (tekst)
          <input
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder="F.eks. RVS-parken"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Start (dato/tid) — hvis du lar den stå tom settes den til i dag kl 18:00
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Varighet (min)
          <input
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, marginTop: 6 }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            Nivå min
            <input
              type="number"
              value={levelMin}
              onChange={(e) => setLevelMin(Number(e.target.value))}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, marginTop: 6 }}
            />
          </label>
          <label>
            Nivå max
            <input
              type="number"
              value={levelMax}
              onChange={(e) => setLevelMax(Number(e.target.value))}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, marginTop: 6 }}
            />
          </label>
        </div>

        <label>
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as SessionType)}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, marginTop: 6 }}
          >
            <option value="moro">moro</option>
            <option value="trening">trening</option>
            <option value="turnering">turnering</option>
          </select>
        </label>

        <label>
          Notater (valgfritt)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, marginTop: 6 }}
          />
        </label>

        <button
          onClick={createRequest}
          disabled={saving}
          style={{ padding: "10px 14px", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Lagrer…" : "Opprett"}
        </button>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer" }}>Debug</summary>
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          {debug || "Ingen debug ennå"}
        </pre>
      </details>
    </div>
  );
}
