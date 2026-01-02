"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
const { createClient } = await import("@/utils/supabase/client");
const supabase = createClient();


export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const sp = useSearchParams();

  const code = sp.get("code");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  // Exchange code->session (når man kommer fra e-post)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
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
  }, [code, supabase]);

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
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMsg("Kunne ikke oppdatere passord. Prøv igjen.");
      setBusy(false);
      return;
    }

    setMsg("Passord oppdatert. Sender deg til innlogging…");
    setBusy(false);

    // Valgfritt: logg ut før login (mange liker dette)
    await supabase.auth.signOut();

    setTimeout(() => {
      router.push("/login?reset=success");
    }, 1200);
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
