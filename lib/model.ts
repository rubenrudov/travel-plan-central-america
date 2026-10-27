import { DateTime, IANAZone } from "luxon";
import { z } from "zod";
export const kinds = [
  "tasks",
  "destinations",
  "segments",
  "bookings",
  "transport",
  "gear",
  "expenses",
  "dives",
  "training",
  "decisions",
  "options",
  "scenarios",
  "contacts",
] as const;
export type Kind = (typeof kinds)[number];
export const recordSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(300),
    status: z.string().default("tentative"),
    notes: z.string().default(""),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
  .superRefine((r, ctx) => {
    for (const prefix of ["", "from", "to"]) {
      const lat = prefix ? prefix + "MapLat" : "mapLat",
        lng = prefix ? prefix + "MapLng" : "mapLng";
      const hasLat = r[lat] !== undefined && r[lat] !== "";
      const hasLng = r[lng] !== undefined && r[lng] !== "";
      if (
        hasLat !== hasLng ||
        (hasLat &&
          (typeof r[lat] !== "number" ||
            typeof r[lng] !== "number" ||
            Math.abs(Number(r[lat])) > 85 ||
            Math.abs(Number(r[lng])) > 180))
      )
        ctx.addIssue({
          code: "custom",
          path: [lat],
          message:
            "Enter both map coordinates: latitude -85 to 85, longitude -180 to 180",
        });
    }

    if (
      r.freeCancellationAt &&
      !z.iso.datetime({ offset: true }).safeParse(r.freeCancellationAt).success
    )
      ctx.addIssue({
        code: "custom",
        path: ["freeCancellationAt"],
        message: "Cancellation deadline must include a UTC offset",
      });
    if (r.cancellationVerified) {
      const local = String(r.freeCancellationLocal || ""),
        zone = String(r.cancellationTimezone || "");
      const time = DateTime.fromISO(local, { zone });
      if (
        r.cancellationPolicy !== "Free cancellation" ||
        !(zone === "UTC" || zone.includes("/")) ||
        !IANAZone.isValidZone(zone) ||
        !time.isValid ||
        time.getPossibleOffsets().length !== 1 ||
        time.toFormat("yyyy-MM-dd'T'HH:mm") !== local ||
        time.toMillis() !== Date.parse(String(r.freeCancellationAt || ""))
      )
        ctx.addIssue({
          code: "custom",
          path: ["cancellationVerified"],
          message:
            "Verify an exact, unambiguous free-cancellation deadline and timezone",
        });
    }

    for (const key of [
      "amount",
      "paid",
      "actual",
      "rental",
      "weight",
      "quantity",
      "depth",
      "duration",
      "distance",
      "elevation",
      "buffer",
      "mobulaDays",
      "dailyCost",
      "rate",
    ]) {
      const value = r[key];
      if (value === undefined || value === "") continue;
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        (key === "rate" && value === 0)
      )
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Expected a nonnegative number (rates must be positive)",
        });
    }
    for (const key of ["date", "end", "checked", "cancelDate", "balanceDate"])
      if (r[key] && !z.iso.date().safeParse(r[key]).success)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Expected an ISO calendar date",
        });
    if (
      typeof r.date === "string" &&
      typeof r.end === "string" &&
      r.date &&
      r.end &&
      r.end < r.date
    )
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "End must follow start",
      });
    if (
      r.currency &&
      !["ILS", "USD", "GTQ", "MXN", "EUR"].includes(String(r.currency))
    )
      ctx.addIssue({
        code: "custom",
        path: ["currency"],
        message: "Unsupported currency",
      });
  });
export type Entry = z.infer<typeof recordSchema>;
export const expeditionSchema = z
  .object({
    id: z.string(),
    title: z.string().min(1),
    start: z.iso.date(),
    end: z.iso.date(),
    budget: z.number().positive(),
    rates: z.record(z.string(), z.number().positive()),
  })
  .refine((x) => x.end >= x.start, { message: "End must follow start" });
export type Expedition = z.infer<typeof expeditionSchema>;
export const stateSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    activeId: z.string(),
    expeditions: z.array(expeditionSchema).min(1),
    records: z.record(
      z.string(),
      z.object(
        Object.fromEntries(
          kinds.map((k) => [k, z.array(recordSchema)]),
        ) as Record<Kind, z.ZodArray<typeof recordSchema>>,
      ),
    ),
  })
  .superRefine((s, ctx) => {
    const ids = s.expeditions.map((e) => e.id);
    if (
      !ids.includes(s.activeId) ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !s.records[id]) ||
      Object.keys(s.records).some((id) => !ids.includes(id))
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid expedition references",
      });
  });
export type State = z.infer<typeof stateSchema>;
export const num = (r: Entry, key: string) => Number(r[key] || 0);
export const str = (r: Entry, key: string) => String(r[key] ?? "");
export function cost(r: Entry, e: Expedition) {
  return (
    num(r, "amount") * (num(r, "rate") || e.rates[str(r, "currency")] || 1)
  );
}
export function totals(records: Record<Kind, Entry[]>, e: Expedition) {
  const bookings = records.bookings.filter((b) => b.status !== "Cancelled");
  const committed = bookings
    .filter((b) => ["Booked", "Paid"].includes(b.status))
    .reduce((s, b) => s + cost(b, e), 0);
  const estimated =
    bookings.reduce((s, b) => s + cost(b, e), 0) +
    records.gear
      .filter((g) => g.ownership === "buy")
      .reduce((s, g) => s + cost(g, e) * Math.max(1, num(g, "quantity")), 0);
  const paid = bookings.reduce(
    (s, b) =>
      s +
      Math.min(
        cost(b, e),
        num(b, "paid") * (num(b, "rate") || e.rates[str(b, "currency")] || 1),
      ),
    0,
  );
  // Linked expenses are payments, already represented by the booking. Only unlinked spending adds to the forecast.
  const actual = records.expenses
    .filter((x) => !x.bookingId)
    .reduce((s, x) => s + cost(x, e), 0);
  return {
    committed,
    estimated: estimated + actual,
    paid,
    actual,
    remaining: e.budget - committed - actual,
  };
}
export function impacts(record: Entry, records: Record<Kind, Entry[]>) {
  return [
    ...records.bookings,
    ...records.transport,
    ...records.segments,
  ].filter(
    (r) =>
      r.id !== record.id &&
      (r.destinationId === (record.destinationId || record.id) ||
        (r.dependencies instanceof Array &&
          r.dependencies.includes(record.id))),
  );
}
export function warnings(records: Record<Kind, Entry[]>) {
  const out: string[] = [];
  for (const t of records.transport) {
    if (!t.date) out.push(`${t.title}: date needs planning`);
    if (t.departure && t.arrival && str(t, "arrival") < str(t, "departure"))
      out.push(
        `${t.title}: arrival precedes departure; verify dates and timezones`,
      );
    if (t.buffer && num(t, "buffer") < 120)
      out.push(
        `${t.title}: transfer buffer under 2 hours; verify with operator`,
      );
  }
  const booked = records.bookings.filter(
    (x) =>
      ["Booked", "Paid"].includes(x.status) &&
      x.date &&
      x.end &&
      x.category === "Accommodation",
  );
  for (let i = 0; i < booked.length; i++)
    for (let j = i + 1; j < booked.length; j++)
      if (
        str(booked[i], "date") < str(booked[j], "end") &&
        str(booked[j], "date") < str(booked[i], "end")
      )
        out.push(
          `Accommodation overlap: ${booked[i].title} / ${booked[j].title}`,
        );
  return out;
}
export function readiness(dives: Entry[]) {
  const actual = dives.filter((d) => d.status === "Completed");
  return {
    count: actual.length,
    last:
      actual
        .map((d) => str(d, "date"))
        .filter(Boolean)
        .sort()
        .at(-1) || null,
  };
}
