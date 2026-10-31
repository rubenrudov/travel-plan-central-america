import { DateTime } from "npm:luxon@3.7.2";
import { admin, checked, accessToken, gmail, digest } from "./runtime.ts";
import {
  extractMailText,
  parseReservation,
  providerForSender,
} from "./parse.ts";
type Connection = {
  owner_id: string;
  email: string;
  refresh_cipher: string;
  last_sync: string | null;
  scan_after: number | null;
  scan_before: number | null;
  page_token: string | null;
};
const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ");
function match(address: string, destinations: Record<string, unknown>[]) {
  const hay = " " + norm(address) + " ";
  const matches = destinations.filter((d) =>
    [String(d.title), ...String(d.aliases || "").split(",")]
      .map((s) => norm(s.trim()))
      .filter((s) => s.length >= 3)
      .some((s) => hay.includes(" " + s + " ")),
  );
  return matches.length === 1 ? String(matches[0].id) : null;
}
export async function applyImport(
  owner: string,
  id: string,
  expeditionId: string,
  destinationId: string,
) {
  const db = admin();
  const item = checked(
    await db
      .from("reservation_inbox")
      .select("*")
      .eq("owner_id", owner)
      .eq("id", id)
      .eq("status", "review")
      .single(),
  );
  const workspace = checked(
    await db
      .from("user_workspaces")
      .select("payload")
      .eq("owner_id", owner)
      .single(),
  )!.payload;
  const records = workspace.records[expeditionId];
  if (
    !records ||
    !records.destinations.some((d: { id: string }) => d.id === destinationId)
  )
    throw Error("Choose a destination in this expedition");
  const candidate = { ...item.candidate };
  const previous = records.bookings.find(
    (b: Record<string, unknown>) =>
      candidate.reference &&
      b.bookingSource === candidate.bookingSource &&
      b.reference === candidate.reference,
  );
  if (!previous) candidate.emailReminder = false;
  candidate.id =
    "gmail-" +
    (
      await digest(
        item.provider + ":" + (candidate.reference || item.source_message_id),
      )
    ).slice(0, 24);
  candidate.destinationId = destinationId;
  candidate.source = item.source_url;
  candidate.importedAt = new Date().toISOString();
  candidate.emailSourceId = item.source_message_id;
  if (
    !candidate.reference ||
    !candidate.date ||
    !candidate.end ||
    !candidate.stayAddress
  ) {
    if (candidate.status !== "Cancelled") candidate.status = "Researching";
  }
  // Missing details in an amendment do not erase known dates/address, but old deadlines must be reverified.
  for (const key of Object.keys(candidate))
    if (candidate[key] === "") delete candidate[key];
  candidate.freeCancellationAt = "";
  candidate.cancellationVerified = false;
  const destination = records.destinations.find(
    (d: { id: string }) => d.id === destinationId,
  );
  const zone =
    candidate.cancellationTimezone ||
    (candidate.deadlineUsesPropertyTime ? destination.timezone : "");
  if (
    (zone === "UTC" || String(zone).includes("/")) &&
    candidate.senderVerified &&
    candidate.cancellationPolicy === "Free cancellation" &&
    candidate.freeCancellationLocal &&
    zone
  ) {
    const deadline = DateTime.fromISO(candidate.freeCancellationLocal, {
      zone,
    });
    if (
      deadline.isValid &&
      deadline.getPossibleOffsets().length === 1 &&
      deadline.toFormat("yyyy-MM-dd'T'HH:mm") ===
        candidate.freeCancellationLocal
    ) {
      candidate.cancellationTimezone = zone;
      candidate.freeCancellationAt = deadline.toUTC().toISO();
      candidate.cancellationVerified = true;
      candidate.cancellationVerificationSource = "Authenticated provider email";
    }
  }
  // New imported stays use in-app alerts only; existing explicit email choices are preserved.
  checked(
    await db.rpc("commit_reservation_import", {
      p_owner: owner,
      p_import: id,
      p_expedition: expeditionId,
      p_booking: candidate,
    }),
  );
}
export async function syncConnection(connection: Connection) {
  const db = admin(),
    token = await accessToken(connection.refresh_cipher);
  const now = Math.floor(Date.now() / 1000);
  const after =
    connection.scan_after ??
    (connection.last_sync
      ? Math.floor(Date.parse(connection.last_sync) / 1000) - 172800
      : now - 365 * 86400);
  const before = connection.scan_before ?? now;
  const query = `{from:booking.com from:hostelworld.com} after:${after} before:${before}`;
  const list = await gmail(
    "messages?" +
      new URLSearchParams({
        q: query,
        maxResults: "20",
        ...(connection.page_token ? { pageToken: connection.page_token } : {}),
      }),
    token,
  );
  for (const entry of list.messages || []) {
    const existing = checked(
      await db
        .from("reservation_inbox")
        .select("id")
        .eq("owner_id", connection.owner_id)
        .eq("source_message_id", entry.id)
        .maybeSingle(),
    );
    if (existing) continue;
    const message = await gmail(
      `messages/${encodeURIComponent(entry.id)}?format=full`,
      token,
    );
    const headers = message.payload?.headers || [];
    const header = (name: string) =>
      headers
        .filter(
          (h: { name: string }) => h.name.toLowerCase() === name.toLowerCase(),
        )
        .map((h: { value: string }) => h.value)
        .join(" ");
    const provider = providerForSender(header("From"));
    if (!provider) continue;
    const candidate = parseReservation(
      header("Subject"),
      extractMailText(message.payload),
      provider,
    );
    const auth =
      headers
        .filter(
          (h: { name: string }) =>
            h.name.toLowerCase() === "authentication-results",
        )
        .map((h: { value: string }) => h.value)
        .find((value: string) => /^\s*mx\.google\.com\s*;/i.test(value)) || "";
    const trusted =
      /\bdmarc=pass\b/i.test(auth) &&
      new RegExp(
        `header.from=(?:[a-z0-9-]+\\.)*${provider === "Booking.com" ? "booking\\.com" : "hostelworld\\.com"}(?:[;\\s]|$)`,
        "i",
      ).test(auth);
    candidate.senderVerified = trusted;
    const sourceUrl = `https://mail.google.com/mail/?authuser=${encodeURIComponent(connection.email)}#all/${entry.id}`;
    const row = checked(
      await db
        .from("reservation_inbox")
        .insert({
          owner_id: connection.owner_id,
          provider,
          source_message_id: entry.id,
          source_url: sourceUrl,
          candidate,
        })
        .select("id")
        .single(),
    );
    if (
      trusted &&
      candidate.reference &&
      candidate.date &&
      candidate.end &&
      candidate.propertyName &&
      candidate.stayAddress &&
      String(candidate.end) > String(candidate.date)
    ) {
      const workspace = checked(
        await db
          .from("user_workspaces")
          .select("payload")
          .eq("owner_id", connection.owner_id)
          .maybeSingle(),
      )?.payload;
      const matches: { expedition: string; destination: string }[] = [];
      if (workspace)
        for (const expedition of workspace.expeditions) {
          if (
            String(candidate.date) < expedition.start ||
            String(candidate.date) > expedition.end
          )
            continue;
          const destination = match(
            String(candidate.stayAddress),
            workspace.records[expedition.id].destinations,
          );
          if (destination)
            matches.push({ expedition: expedition.id, destination });
        }
      if (matches.length === 1)
        await applyImport(
          connection.owner_id,
          row!.id,
          matches[0].expedition,
          matches[0].destination,
        );
    }
  }
  checked(
    await db
      .from("gmail_connections")
      .update(
        list.nextPageToken
          ? {
              scan_after: after,
              scan_before: before,
              page_token: list.nextPageToken,
              last_error: null,
            }
          : {
              scan_after: null,
              scan_before: null,
              page_token: null,
              last_sync: new Date(before * 1000).toISOString(),
              last_error: null,
            },
      )
      .eq("owner_id", connection.owner_id),
  );
}
function rawEmail(to: string, subject: string, body: string, id: string) {
  const data = `To: ${to}\r\nSubject: ${subject}\r\nMessage-ID: <${id}@adventure-os.local>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${btoa(String.fromCharCode(...new TextEncoder().encode(body)))}`;
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function sendReminders(connection: Connection) {
  const db = admin();
  const workspace = checked(
    await db
      .from("user_workspaces")
      .select("payload")
      .eq("owner_id", connection.owner_id)
      .maybeSingle(),
  )?.payload;
  if (!workspace) return;
  const pending = checked(
    await db
      .from("reservation_inbox")
      .select("provider,candidate")
      .eq("owner_id", connection.owner_id)
      .eq("status", "review"),
  );
  let token: string | undefined;
  for (const expedition of workspace.expeditions)
    for (const booking of workspace.records[expedition.id].bookings) {
      if (
        booking.archived || !["Booked", "Paid", "Confirmed booking", "Refundable booking", "Tentative booking"].includes(booking.status) ||
        booking.cancellationPolicy !== "Free cancellation" ||
        booking.cancellationVerified !== true ||
        !booking.freeCancellationAt ||
        !booking.emailReminder
      )
        continue;
      if (
        (pending || []).some(
          (p: { provider: string; candidate: { reference?: string } }) =>
            p.provider === booking.bookingSource &&
            p.candidate.reference &&
            p.candidate.reference === booking.reference,
        )
      )
        continue;
      const deadline = DateTime.fromISO(booking.freeCancellationAt, {
        setZone: true,
      }).setZone(booking.cancellationTimezone);
      if (
        !deadline.isValid ||
        deadline.toMillis() <= Date.now() ||
        deadline.minus({ weeks: 1 }).toMillis() > Date.now()
      )
        continue;
      const key = await digest(
        `${expedition.id}:${booking.id}:${deadline.toUTC().toISO()}`,
      );
      const claim = await db.from("reservation_email_deliveries").insert({
        owner_id: connection.owner_id,
        delivery_key: key,
        status: "sending",
      });
      if (claim.error) {
        if (claim.error.code === "23505") continue;
        throw Error("Could not claim reminder delivery");
      }
      try {
        token ??= await accessToken(connection.refresh_cipher);
        const body = `Adventure OS cancellation reminder\n\n${String(booking.title).replace(/[\r\n]/g, " ")}\n${expedition.title}\nFree cancellation ends: ${deadline.toFormat("yyyy-MM-dd HH:mm ZZZZ")} (${booking.cancellationTimezone})\nAddress: ${booking.stayAddress || "Not entered"}\nReference: ${booking.reference || "Not entered"}\n\nA week-before reminder, or a catch-up reminder if you enabled it less than a week before the deadline. Verify the provider's original terms before acting. No cancellation has been made.\n\nhttps://rubenrudov.github.io/travel-plan-central-america/`;
        await gmail("messages/send", token, {
          method: "POST",
          body: JSON.stringify({
            raw: rawEmail(
              connection.email,
              "Adventure OS: free cancellation deadline approaching",
              body,
              key,
            ),
          }),
        });
        checked(
          await db
            .from("reservation_email_deliveries")
            .update({ status: "sent" })
            .eq("owner_id", connection.owner_id)
            .eq("delivery_key", key),
        );
      } catch {
        checked(
          await db
            .from("reservation_email_deliveries")
            .update({ status: "uncertain" })
            .eq("owner_id", connection.owner_id)
            .eq("delivery_key", key),
        );
        throw Error(
          "Reminder delivery is uncertain. Check Gmail Sent and in-app cancellation alerts; automatic retries are paused to prevent duplicates.",
        );
      }
    }
}
