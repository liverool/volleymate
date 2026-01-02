"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function MePage() {
  const supabase = createClient();
  const [text, setText] = useState("Laster...");

  useEffect(() => {
    async function run() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setText("Du er ikke innlogget. Gå til /login");
        return;
      }

      setText(`Innlogget ✅ (${user.email})`);
    }

    run();
  }, [supabase]);

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Min side</h1>
      <p style={{ marginTop: 12 }}>{text}</p>
    </div>
  );
}
