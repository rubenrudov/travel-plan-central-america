import { admin, env, json, checked } from "../_shared/runtime.ts";
import { syncConnection, sendReminders } from "../_shared/jobs.ts";
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const supplied = req.headers.get("x-job-secret") || "";
  const expected = env("RESERVATION_JOB_SECRET");
  const a = new TextEncoder().encode(supplied),
    b = new TextEncoder().encode(expected);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) mismatch |= (a[i] || 0) ^ b[i];
  if (mismatch) return json({ error: "Unauthorized" }, 401);
  const db = admin();
  try {
    const rows = checked(await db.from("gmail_connections").select("*"));
    let processed = 0,
      failed = 0;
    for (const row of rows || []) {
      try {
        await syncConnection(row);
        await sendReminders(row);
        processed++;
      } catch (e) {
        failed++;
        await db
          .from("gmail_connections")
          .update({
            last_error:
              e instanceof Error ? e.message : "Reservation sync failed",
          })
          .eq("owner_id", row.owner_id);
      }
    }
    return json({ processed, failed });
  } catch {
    return json({ error: "Background reservation job failed" }, 500);
  }
});
