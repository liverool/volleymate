"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  // Hold på en promise til supabase-client (ingen top-level import)
  const supabasePromiseRef = useRef<Promise<any> | null>(null);

  function getSupabase() {
    if (!supabasePromiseRef.current) {
      supabasePromiseRef.current = (async () => {
        const { createClient } = await import("@/utils/supabase/client");
        return createClient();
      })();
    }
    return supabasePromiseRef.current;
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Hent code fra URL kun i browser
        const code = new URLSearchParams(window.location.search).get("code");

        const supabase = await getSupabase();
        if (!supabase) {
          setMsg("Teknisk feil: Supabase er ikke tilgjengelig.");
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setMsg("Lenken er ugyldig eller utløpt. Prøv å be om ny reset-lenke.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password.length < 8) {
      setMsg("Passordet må være minst 8 tegn.");
      return;
    }
    if (password !== password2) {
      setMsg("Passordene er ikke like.");
      return;
    }

    setBusy(true);

    try {
      const supabase = await getSupabase();
      if (!supabase) throw new Error("Supabase er ikke tilgjengelig.");

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMsg("Passord oppdatert. Sender deg til innlogging…");

      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/login?reset=success");
      }, 1200);
    } catch {
      setMsg("Kunne ikke oppdatere passord. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
        Laster…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Velg nytt passord</h1>

      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 6 }}>Nytt passord</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            border: "1px solid #ccc",
          }}
        />

        <label style={{ display: "block", marginBottom: 6 }}>
          Gjenta passord
        </label>
        <input
          type="password"
          required
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            border: "1px solid #ccc",
          }}
        />

        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "none",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Oppdaterer…" : "Oppdater passord"}
        </button>
      </form>

      {msg && <p style={{ marginTop: 16, lineHeight: 1.4 }}>{msg}</p>}
    </div>
  );
}
