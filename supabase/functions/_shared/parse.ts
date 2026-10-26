export type Candidate = Record<string, string | boolean | number>;
export function providerForSender(sender: string) {
  const address = (sender.match(/<([^>]+)>/)?.[1] || sender)
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(address)) return null;
  const host = address.split("@")[1];
  if (host === "booking.com" || host.endsWith(".booking.com"))
    return "Booking.com";
  if (host === "hostelworld.com" || host.endsWith(".hostelworld.com"))
    return "Hostelworld";
  return null;
}
const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
function calendarDate(text: string) {
  let value = text.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
  let y: number, m: number, d: number;
  if (value) {
    y = +value[1];
    m = +value[2];
    d = +value[3];
  } else {
    value = text.match(
      /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d\d)\b/i,
    );
    if (value) {
      y = +value[3];
      m = months.indexOf(value[2].toLowerCase()) + 1;
      d = +value[1];
    } else {
      value = text.match(
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d\d)\b/i,
      );
      if (!value) return "";
      y = +value[3];
      m = months.indexOf(value[1].toLowerCase()) + 1;
      d = +value[2];
    }
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    : "";
}
export function parseReservation(
  subject: string,
  text: string,
  provider: string,
): Candidate {
  const clean = text.replace(/\r/g, "");
  const line = (pattern: RegExp) => clean.match(pattern)?.[1]?.trim() || "";
  const reference = line(
    /(?:confirmation number|confirmation code|booking reference|booking number|reservation number|reservation id|מספר הזמנה)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{4,40})/i,
  );
  const property =
    line(
      /(?:property name|hostel name|hotel name|accommodation|property|hostel|hotel)\s*:\s*([^\n]{2,180})/i,
    ) ||
    subject.match(
      /(?:booking|reservation) at (.+?)(?: is confirmed| confirmation|$)/i,
    )?.[1] ||
    "";
  const readDate = (pattern: RegExp) => {
    const found = clean.match(pattern);
    if (!found) return "";
    const first = found[1].trim();
    const parsed = calendarDate(first);
    if (parsed) return parsed;
    if (
      first &&
      !/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?$/i.test(
        first,
      )
    )
      return "";
    const next =
      clean.slice(found.index! + found[0].length).split("\n")[1] || "";
    if (
      /^(?:check[ -]?in|check[ -]?out|arrival date|departure date|address)\b/i.test(
        next.trim(),
      )
    )
      return "";
    return calendarDate(next);
  };
  const date = readDate(
    /(?:check[ -]?in|arrival date|תאריך כניסה)[ \t]*[:\-]?[ \t]*([^\n]*)/i,
  );
  const end = readDate(
    /(?:check[ -]?out|departure date|תאריך יציאה)[ \t]*[:\-]?[ \t]*([^\n]*)/i,
  );
  const stayAddress = line(
    /(?:property address|address|כתובת)\s*:\s*([^\n]{3,300})/i,
  );
  const cancelled =
    /\b(?:cancelled|canceled|cancellation confirmed)\b/i.test(subject) ||
    /^(?:your )?(?:booking|reservation) (?:has been |is )?cancelled[.!]?$/im.test(
      clean,
    );
  const deadlineLines = [
    ...new Set(
      clean
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) =>
            /(?:free cancellation|cancel for free|cancel.{0,25}free of charge)/i.test(
              line,
            ) && /(?:until|before|ends|deadline)/i.test(line),
        ),
    ),
  ];
  const deadlineLine = deadlineLines.length === 1 ? deadlineLines[0] : "";
  const deadlineDate = calendarDate(deadlineLine),
    clock = deadlineLine.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i);
  let deadlineLocal = "";
  if (deadlineDate && clock) {
    let hour = Number(clock[1]);
    const minute = Number(clock[2]);
    if (clock[3]) {
      if (hour >= 1 && hour <= 12)
        hour = (hour % 12) + (clock[3].toUpperCase() === "PM" ? 12 : 0);
      else hour = 99;
    }
    if (hour < 24 && minute < 60)
      deadlineLocal =
        deadlineDate +
        "T" +
        String(hour).padStart(2, "0") +
        ":" +
        String(minute).padStart(2, "0");
  }
  const deadlineZone =
    deadlineLine.match(
      /\b((?:America|Europe|Asia|Africa|Pacific|Australia|Atlantic|Indian|Etc)\/[A-Za-z_+0-9/-]+)\b/,
    )?.[1] || "";
  const propertyLocalTime =
    /property(?:'s|’s)? local time|local time (?:at|of) (?:the )?property/i.test(
      clean,
    );
  const cancellationPolicy =
    !deadlineLine && /\bnon[ -]refundable\b/i.test(clean)
      ? "Non-refundable"
      : !!deadlineLine || /\bfree cancellation\b/i.test(clean)
        ? "Free cancellation"
        : "Unknown";
  return {
    id: "pending",
    title: property || subject.slice(0, 200) || "Reservation to review",
    propertyName: property,
    bookingSource: provider,
    provider,
    reference,
    date,
    end,
    stayAddress,
    category: "Accommodation",
    status: cancelled ? "Cancelled" : "Booked",
    cancellationPolicy,
    cancellationVerified: false,
    freeCancellationLocal: deadlineLocal,
    cancellationTimezone: deadlineZone,
    deadlineUsesPropertyTime: propertyLocalTime,
    notes:
      "Imported from Gmail. Verify the original cancellation terms, exact deadline and timezone before enabling reminders.",
  };
}
export function extractMailText(
  payload:
    | { mimeType?: string; body?: { data?: string }; parts?: unknown[] }
    | undefined,
): string {
  if (!payload) return "";
  let text = "";
  if (payload.body?.data) {
    const bytes = Uint8Array.from(
      atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    text = new TextDecoder().decode(bytes);
    if (payload.mimeType === "text/html")
      text = text
        .replace(/<(?:br|\/p|\/div|\/tr)[^>]*>/gi, "\n")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
  }
  const parts = (payload.parts || []) as (typeof payload)[];
  const plain = parts.filter((p) => p.mimeType === "text/plain");
  return [
    text,
    ...(plain.length ? plain : parts).map((p) => extractMailText(p)),
  ]
    .filter(Boolean)
    .join("\n");
}
