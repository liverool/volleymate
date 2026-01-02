"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [level, setLevel] = useState(5);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setDisplayName(data.display_name ?? "");
        setMunicipality(data.home_municipality ?? "");
        setLevel(data.level ?? 5);
      }

      setLoading(false);
    }

    loadProfile();
  }, [router, supabase]);

  async function save() {
    setMsg("Lagrer...");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      display_name: displayName,
      home_municipality: municipality,
      level,
    });

    if (error) {
      setMsg(error.message);
    } else {
      router.push("/requests");
    }
  }

  if (loading) return <p style={{ padding: 20 }}>Laster...</p>;

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Velkommen 👋</h1>

      <label>Navn / kallenavn</label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 12 }}
      />

      <label>Kommune</label>
      <input
        value={municipality}
        onChange={(e) => setMunicipality(e.target.value)}
        placeholder="f.eks. Drammen"
        style={{ width: "100%", padding: 10, marginBottom: 12 }}
      />

      <label>Nivå (1–10)</label>
      <input
        type="number"
        min={1}
        max={10}
        value={level}
        onChange={(e) => setLevel(Number(e.target.value))}
        style={{ width: "100%", padding: 10, marginBottom: 20 }}
      />

      <button onClick={save} style={{ padding: 12, width: "100%" }}>
        Lagre og fortsett
      </button>

      <p style={{ marginTop: 12 }}>{msg}</p>
    </div>
  );
}
