import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Kun i browser
  if (typeof window === "undefined") return null as any;

  const urlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keyRaw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const url = (urlRaw ?? "").trim();
  const key = (keyRaw ?? "").trim();

  // DEBUG (midlertidig): se hva browser faktisk får
  console.log("NEXT_PUBLIC_SUPABASE_URL =", JSON.stringify(urlRaw));
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY exists =", !!keyRaw);

  // Ikke crash hele appen – returner null hvis feil
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
  } catch {
    console.error("Invalid Supabase URL in browser:", JSON.stringify(urlRaw));
    return null as any;
  }

  if (!key) {
    console.error("Missing Supabase anon key in browser");
    return null as any;
  }

  return createBrowserClient(url, key);
}
