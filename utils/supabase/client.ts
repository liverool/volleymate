import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // ⚠️ Viktig: Under build / prerender finnes ikke window
  if (typeof window === "undefined") {
    // Returner en "dummy" – brukes aldri, men hindrer crash
    return null as any;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // ❗ IKKE kast feil her – build må aldri kræsje
  if (!url || !key) {
    console.warn("Supabase env vars mangler i browser");
    return null as any;
  }

  return createBrowserClient(url, key);
}
