"use client";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    // Av sikkerhetsgrunner: alltid samme svar, også ved error.
    if (error) {
      setMsg(
        "Hvis e-posten finnes, er det sendt en lenke for å sette nytt passord. Sjekk også søppelpost."
      );
    } else {
      setMsg(
        "Hvis e-posten finnes, er det sendt en lenke for å sette nytt passord. Sjekk også søppelpost."
      );
    }

    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Glemt passord</h1>

      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 6 }}>E-post</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="deg@epost.no"
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
          {busy ? "Sender…" : "Send reset-lenke"}
        </button>
      </form>

      {msg && (
        <p style={{ marginTop: 16, lineHeight: 1.4 }}>
          {msg}
        </p>
      )}

      <p style={{ marginTop: 20 }}>
        <Link href="/login">Tilbake til innlogging</Link>
      </p>
    </div>
  );
}
