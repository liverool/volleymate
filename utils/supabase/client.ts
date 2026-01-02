import { createBrowserClient } from "@supabase/ssr";

// Next bruker denne under build
const IS_BUILD =
  process.env.NEXT_PHASE === "phase-production-build";

export function createClient() {
  // 🚫 Under build: ikke lag Supabase i det hele tatt
  if (IS_BUILD || typeof window === "undefined") {
    return null as any;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    console.warn("Supabase env mangler i runtime");
    return null as any;
  }

  return createBrowserClient(url, key);
}
