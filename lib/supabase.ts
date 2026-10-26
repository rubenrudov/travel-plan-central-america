import { createClient, SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export const cloudMode = process.env.NEXT_PUBLIC_STORAGE_MODE === "supabase";
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export function cloudConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
export function getSupabase() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key)
      throw Error(
        "Supabase project configuration is missing. See docs/DEPLOYMENT.md.",
      );
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  }
  return client;
}
