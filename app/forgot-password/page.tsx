"use client";

import { useState } from "react";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      // Viktig: lazy import (IKKE import supabase i toppen av fila)
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();

      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;

      setMsg("Sjekk e-posten din for reset-lenke (og spam).");
    } catch (err: any) {
      setMsg(err?.message ?? "Noe gikk galt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Glemt passord</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          E-post
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #111",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Sender..." : "Send reset-lenke"}
        </button>

        {msg ? <p style={{ marginTop: 6 }}>{msg}</p> : null}
      </form>
    </main>
  );
}
