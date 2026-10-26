import { createClient } from "npm:@supabase/supabase-js@2.118.0";
export const appUrl =
  Deno.env.get("ADVENTURE_APP_URL") ||
  "https://rubenrudov.github.io/travel-plan-central-america/";
export const cors = {
  "Access-Control-Allow-Origin": new URL(appUrl).origin,
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function env(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw Error(`Server setup missing: ${key}`);
  return value;
}
export function admin() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
export async function owner(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (!token) throw Error("Sign in first");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw Error("Sign in first");
  return data.user.id;
}
export function checked<T>(result: {
  data: T;
  error: { message: string } | null;
}): T {
  if (result.error) throw Error(result.error.message);
  return result.data;
}
export async function digest(text: string) {
  const data = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(data), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
function b64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
export async function tokenCrypt(text: string, decrypt = false) {
  const raw = Uint8Array.from(atob(env("GMAIL_TOKEN_ENCRYPTION_KEY")), (c) =>
    c.charCodeAt(0),
  );
  if (raw.length !== 32)
    throw Error("Gmail encryption key must contain 32 random bytes");
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  if (decrypt) {
    const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes.slice(0, 12) },
        key,
        bytes.slice(12),
      ),
    );
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const result = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(text),
    ),
  );
  return b64(new Uint8Array([...iv, ...result]));
}
export async function googleToken(fields: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      ...fields,
    }),
  });
  const body = await res.json();
  if (!res.ok)
    throw Error(
      body.error === "invalid_grant"
        ? "Gmail authorization expired or was revoked. Reconnect Gmail."
        : "Google authorization failed. Check the OAuth app configuration.",
    );
  return body;
}
export async function accessToken(cipher: string) {
  return (
    await googleToken({
      grant_type: "refresh_token",
      refresh_token: await tokenCrypt(cipher, true),
    })
  ).access_token as string;
}
export async function gmail(
  path: string,
  token: string,
  init: RequestInit = {},
) {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/" + path,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    },
  );
  if (!res.ok)
    throw Error(
      "Gmail request failed. Check authorization and quota, then reconnect if needed.",
    );
  return res.status === 204 ? {} : await res.json();
}
