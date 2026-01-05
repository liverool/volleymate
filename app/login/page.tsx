"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
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
        // ignore
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

      const dn = displayName.trim();
      if (!dn) {
        setMessage("error", "Skriv inn navn.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          data: { display_name: dn },
        },
      });

      if (error) throw error;

      if (data.user?.id) {
        const { error: profErr } = await supabase
          .from("profiles")
          .upsert({ user_id: data.user.id, display_name: dn }, { onConflict: "user_id" });

        if (profErr) console.warn("profiles upsert failed:", profErr.message);
      }

      if (!data.session) {
        setMessage(
          "success",
          `Bruker opprettet! Sjekk e-posten (${email}) og bekreft kontoen. Deretter kan du logge inn.`
        );
        setMode("login");
        setPassword("");
        setDisplayName("");
        return;
      }

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

      setMessage("success", `Sendt! Sjekk e-posten (${email}) for bekreftelseslink.`);
    } catch (err: any) {
      setMessage("error", err?.message ?? "Kunne ikke sende e-post på nytt.");
    } finally {
      setBusy(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: 440,
    margin: "24px auto",
    padding: 16,
  };

  const panelStyle: React.CSSProperties = {
    border: "1px solid #e5e5e5",
    borderRadius: 14,
    padding: 16,
  };

  const labelStyle: React.CSSProperties = { display: "grid", gap: 6 };

  const inputStyle: React.CSSProperties = {
    padding: 12,
    borderRadius: 10,
    border: "1px solid #ccc",
    width: "100%",
    fontSize: 16, // ✅ bedre på mobil (hindrer zoom på iOS)
  };

  const primaryBtn: React.CSSProperties = {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #111",
    cursor: busy ? "not-allowed" : "pointer",
    width: "100%",
    fontSize: 16,
  };

  const toggleWrap: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 12,
  };

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    padding: 12,
    borderRadius: 12,
    border: "1px solid #ccc",
    background: active ? "#111" : "transparent",
    color: active ? "#fff" : "#111",
    width: "100%",
    fontSize: 16,
  });

  return (
    <main style={cardStyle}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>{mode === "login" ? "Logg inn" : "Registrer"}</h1>
      <div style={{ color: "#666", fontSize: 14, marginBottom: 16 }}>
        {mode === "login" ? "Velkommen tilbake." : "Lag en bruker for å opprette og chatte på requests."}
      </div>

      <div style={panelStyle}>
        <div style={toggleWrap}>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMsg("");
            }}
            disabled={busy}
            style={toggleBtn(mode === "login")}
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
            style={toggleBtn(mode === "register")}
          >
            Register
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          {mode === "register" ? (
            <label style={labelStyle}>
              Navn
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                placeholder="F.eks. Jan Roger"
                style={inputStyle}
              />
            </label>
          ) : null}

          <label style={labelStyle}>
            E-post
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              autoComplete="email"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Passord
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={inputStyle}
            />
          </label>

          <button type="submit" disabled={busy} style={primaryBtn}>
            {busy ? "Jobber..." : mode === "login" ? "Logg inn" : "Opprett bruker"}
          </button>

          {msg ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                lineHeight: 1.4,
                background:
                  msgType === "error" ? "#fff5f5" : msgType === "success" ? "#f4fff6" : "#f7f7f7",
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
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid #ccc",
                    width: "100%",
                    fontSize: 16,
                  }}
                >
                  Send bekreftelsesmail på nytt
                </button>
              ) : null}
            </div>
          ) : null}
        </form>

        <div style={{ marginTop: 14 }}>
          <a href="/forgot-password" style={{ display: "inline-block", padding: "10px 0" }}>
            Glemt passord?
          </a>
        </div>
      </div>
    </main>
  );
}
