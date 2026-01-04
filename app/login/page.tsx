"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [msgType, setMsgType] = useState<"info" | "error" | "success">("info");

  function setMessage(type: "info" | "error" | "success", text: string) {
    setMsgType(type);
    setMsg(text);
  }

  // Hvis allerede innlogget: send til /
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) router.replace("/");
      } catch {
        // Ikke kræsje UI
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          const m = (error.message || "").toLowerCase();
          if (
            m.includes("email not confirmed") ||
            m.includes("not confirmed") ||
            m.includes("confirm")
          ) {
            setMessage(
              "info",
              `E-posten er ikke bekreftet ennå. Sjekk innboksen din (${email}). Du kan sende bekreftelsesmail på nytt under.`
            );
            return;
          }
          throw error;
        }

        router.replace("/");
        return;
      }

      // REGISTER
      const origin = window.location.origin;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) throw error;

      // Vanlig når e-postbekreftelse er på: session=null
      if (!data.session) {
        setMessage(
          "success",
          `Bruker opprettet! Sjekk e-posten (${email}) og bekreft kontoen. Deretter kan du logge inn.`
        );
        setMode("login");
        setPassword("");
        return;
      }

      // Hvis confirmation er av og session finnes:
      router.replace("/");
    } catch (err: any) {
      setMessage("error", err?.message ?? "Noe gikk galt.");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!email) {
      setMessage("error", "Skriv inn e-post først.");
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const origin = window.location.origin;

      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) throw error;

      setMessage(
        "success",
        `Sendt! Sjekk e-posten (${email}) for bekreftelseslink.`
      );
    } catch (err: any) {
      setMessage("error", err?.message ?? "Kunne ikke sende e-post på nytt.");
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
          onClick={() => {
            setMode("login");
            setMsg("");
          }}
          disabled={busy}
          style={{
            padding: 8,
            borderRadius: 10,
            border: "1px solid #ccc",
            background: mode === "login" ? "#f2f2f2" : "transparent",
          }}
        >
          Login
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("register");
            setMsg("");
          }}
          disabled={busy}
          style={{
            padding: 8,
            borderRadius: 10,
            border: "1px solid #ccc",
            background: mode === "register" ? "#f2f2f2" : "transparent",
          }}
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
            onChange={(e) => setEmail(e.target.value.trim())}
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

        {msg ? (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              lineHeight: 1.4,
            }}
          >
            <p style={{ margin: 0 }}>{msg}</p>

            {mode === "login" && msgType === "info" ? (
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={busy}
                style={{
                  marginTop: 10,
                  padding: 8,
                  borderRadius: 10,
                  border: "1px solid #ccc",
                }}
              >
                Send bekreftelsesmail på nytt
              </button>
            ) : null}
          </div>
        ) : null}
      </form>

      <p style={{ marginTop: 12 }}>
        <a href="/forgot-password">Glemt passord?</a>
      </p>
    </main>
  );
}
