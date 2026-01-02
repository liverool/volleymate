"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Hvis du allerede er innlogget: send til /
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) router.push("/");
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    setMsg("");
    setBusy(true);

    try {
      if (!email.trim() || !password.trim()) {
        setMsg("Fyll inn e-post og passord.");
        return;
      }

      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setMsg(error.message);
          return;
        }

        setMsg("Bruker opprettet ✅ Du kan nå logge inn.");
        setMode("login");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setMsg("");
    await supabase.auth.signOut();
    setMsg("Logget ut.");
  }

  if (loading) return <div style={{ padding: 20 }}>Laster…</div>;

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Volleymate</h1>
      <p style={{ marginTop: 6, opacity: 0.85 }}>
        {mode === "login" ? "Logg inn for å finne makker" : "Registrer ny bruker"}
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          onClick={() => setMode("login")}
          style={{
            flex: 1,
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 10,
            fontWeight: 700,
            opacity: mode === "login" ? 1 : 0.6,
          }}
        >
          Logg inn
        </button>
        <button
          onClick={() => setMode("register")}
          style={{
            flex: 1,
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 10,
            fontWeight: 700,
            opacity: mode === "register" ? 1 : 0.6,
          }}
        >
          Registrer
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: "block", fontWeight: 700 }}>E-post</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="deg@epost.no"
          style={{
            width: "100%",
            padding: 10,
            marginTop: 6,
            border: "1px solid #ddd",
            borderRadius: 10,
          }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ display: "block", fontWeight: 700 }}>Passord</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minst 6 tegn"
          style={{
            width: "100%",
            padding: 10,
            marginTop: 6,
            border: "1px solid #ddd",
            borderRadius: 10,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </div>

      {/* ✅ NYTT: Glemt passord-lenke (kun i login-modus) */}
      {mode === "login" ? (
        <div style={{ marginTop: 10, textAlign: "right" }}>
          <Link href="/forgot-password" style={{ fontSize: 13, fontWeight: 700, opacity: 0.8 }}>
            Glemt passord?
          </Link>
        </div>
      ) : null}

      <button
        onClick={submit}
        disabled={busy}
        style={{
          width: "100%",
          padding: 12,
          marginTop: 14,
          borderRadius: 12,
          fontWeight: 800,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Jobber…" : mode === "login" ? "Logg inn" : "Opprett bruker"}
      </button>

      <button
        onClick={signOut}
        style={{
          width: "100%",
          padding: 12,
          marginTop: 10,
          borderRadius: 12,
          border: "1px solid #ddd",
          background: "transparent",
        }}
      >
        Logg ut (test)
      </button>

      {msg ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          {msg}
        </div>
      ) : null}

      <p style={{ marginTop: 14, fontSize: 12, opacity: 0.75 }}>
        Tips: Hvis du er innlogget sendes du automatisk videre.
      </p>
    </div>
  );
}
