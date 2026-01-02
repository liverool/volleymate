"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";


export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Ikke opprett Supabase på toppnivå. Lazy-load når vi trenger den.
  async function getSupabase() {
    const { createClient } = await import("@/utils/supabase/client");
    return createClient();
  }

  useEffect(() => {
    (async () => {
      try {
        const supabase = await getSupabase();
        if (!supabase) return;

        const { data } = await supabase.auth.getSession();
        if (data.session) router.replace("/");
      } catch {
        // ikke kræsje UI
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    try {
      const supabase = await getSupabase();
      if (!supabase) throw new Error("Supabase er ikke tilgjengelig.");

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMsg("Bruker opprettet. Sjekk e-post hvis bekreftelse er på.");
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Noe gikk galt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>
        {mode === "login" ? "Logg inn" : "Registrer"}
      </h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setMode("login")}
          disabled={busy}
          style={{ padding: 8, borderRadius: 10 }}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          disabled={busy}
          style={{ padding: 8, borderRadius: 10 }}
        >
          Register
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          E-post
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Passord
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
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
          {busy ? "Jobber..." : mode === "login" ? "Logg inn" : "Opprett bruker"}
        </button>

        {msg ? <p>{msg}</p> : null}
      </form>

      <p style={{ marginTop: 12 }}>
        <a href="/forgot-password">Glemt passord?</a>
      </p>
    </main>
  );
}
