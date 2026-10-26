import {
  admin,
  appUrl,
  cors,
  env,
  json,
  owner,
  checked,
  digest,
  tokenCrypt,
  googleToken,
  gmail,
} from "../_shared/runtime.ts";
import { applyImport, syncConnection } from "../_shared/jobs.ts";
const redirect = () =>
  env("SUPABASE_URL") + "/functions/v1/gmail-connect?callback=1";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.has("callback")) {
    try {
      const state = url.searchParams.get("state");
      if (!state) throw Error("Invalid callback");
      const db = admin();
      const stored = checked(
        await db
          .from("gmail_oauth_states")
          .delete()
          .eq("state_hash", await digest(state))
          .gt("expires_at", new Date().toISOString())
          .select("owner_id")
          .single(),
      );
      if (url.searchParams.has("error")) throw Error("Authorization declined");
      const code = url.searchParams.get("code");
      if (!code) throw Error("Missing authorization code");
      const tokens = await googleToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirect(),
      });
      if (
        !tokens.refresh_token ||
        !String(tokens.scope || "").includes("gmail.readonly") ||
        !String(tokens.scope || "").includes("gmail.send")
      )
        throw Error("Required authorization not granted");
      const profile = await gmail("profile", tokens.access_token);
      checked(
        await db.from("gmail_connections").upsert({
          owner_id: stored!.owner_id,
          email: profile.emailAddress,
          refresh_cipher: await tokenCrypt(tokens.refresh_token),
          last_error: null,
          scan_after: null,
          scan_before: null,
          page_token: null,
        }),
      );
      return Response.redirect(appUrl + "?gmail=connected", 303);
    } catch {
      return Response.redirect(appUrl + "?gmail=error", 303);
    }
  }
  try {
    if (req.method !== "POST")
      return json({ error: "Method not allowed" }, 405);
    const user = await owner(req);
    const body = await req.json(),
      db = admin();
    if (body.action === "status") {
      const row = checked(
        await db
          .from("gmail_connections")
          .select("email,last_sync,last_error")
          .eq("owner_id", user)
          .maybeSingle(),
      );
      return json({ connected: !!row, ...row });
    }
    if (body.action === "connect") {
      const state = crypto.randomUUID() + crypto.randomUUID();
      checked(
        await db
          .from("gmail_oauth_states")
          .delete()
          .lt("expires_at", new Date().toISOString()),
      );
      checked(
        await db.from("gmail_oauth_states").insert({
          state_hash: await digest(state),
          owner_id: user,
          expires_at: new Date(Date.now() + 600000).toISOString(),
        }),
      );
      const params = new URLSearchParams({
        client_id: env("GOOGLE_CLIENT_ID"),
        redirect_uri: redirect(),
        response_type: "code",
        scope:
          "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
        access_type: "offline",
        prompt: "consent",
        state,
      });
      return json({
        url: "https://accounts.google.com/o/oauth2/v2/auth?" + params,
      });
    }
    if (body.action === "disconnect") {
      const row = checked(
        await db
          .from("gmail_connections")
          .select("refresh_cipher")
          .eq("owner_id", user)
          .maybeSingle(),
      );
      let revoked = true;
      if (row) {
        try {
          const response = await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              token: await tokenCrypt(row.refresh_cipher, true),
            }),
          });
          revoked = response.ok;
        } catch {
          revoked = false;
        }
        checked(
          await db.from("gmail_connections").delete().eq("owner_id", user),
        );
      }
      return json({ disconnected: true, revoked });
    }
    if (body.action === "sync") {
      const row = checked(
        await db
          .from("gmail_connections")
          .select("*")
          .eq("owner_id", user)
          .single(),
      );
      await syncConnection(row);
      return json({ ok: true });
    }
    if (body.action === "ignore") {
      checked(
        await db
          .from("reservation_inbox")
          .update({ status: "ignored" })
          .eq("owner_id", user)
          .eq("id", body.id),
      );
      return json({ ok: true });
    }
    if (body.action === "apply") {
      await applyImport(user, body.id, body.expeditionId, body.destinationId);
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Integration failed" },
      400,
    );
  }
});
