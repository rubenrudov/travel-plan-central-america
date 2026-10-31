import { DateTime, IANAZone } from "luxon";
import { z } from "zod";
import { isActive, isCancelled, isExistingBooking } from "./booking-status";
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
      "deposit",
      "refunded",
      "budgetMin",
      "budgetMax",
      "plannedDays",
      "plannedDives",
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
    for (const key of [
      "date",
      "end",
      "checked",
      "cancelDate",
      "balanceDate",
      "postponedUntil",
      "lastDiveDate",
    ])
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
    planVersion: z.string().optional(),
    previousTitle: z.string().optional(),
    previousStart: z.string().optional(),
    previousEnd: z.string().optional(),
    budgetMin: z.number().nonnegative().optional(),
    budgetMax: z.number().positive().optional(),
    reserve: z.number().nonnegative().optional(),
    categoryBudgets: z.record(z.string(), z.number().nonnegative()).optional(),
    certification: z.string().optional(),
    currentExperience: z.string().optional(),
  })
  .refine((x) => x.end >= x.start, { message: "End must follow start" })
  .refine(
    (x) =>
      x.budgetMin === undefined ||
      x.budgetMax === undefined ||
      x.budgetMin <= x.budgetMax,
    {
      message: "גבול התקציב התחתון חייב להיות קטן מהגבול העליון או שווה לו",
      path: ["budgetMax"],
    },
  );
export type Expedition = z.infer<typeof expeditionSchema>;
export const workspaceEnvelopeSchema = z.object({
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
});
export const stateSchema = workspaceEnvelopeSchema.superRefine((s, ctx) => {
  const ids = s.expeditions.map((e) => e.id);
  if (!ids.includes(s.activeId))
    ctx.addIssue({
      code: "custom",
      message: "The active expedition does not exist in the expedition list",
      path: ["activeId"],
    });
  for (let i = 0; i < ids.length; i++) {
    if (ids.indexOf(ids[i]) !== i)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate expedition ID",
        path: ["expeditions", i, "id"],
      });
    if (!Object.hasOwn(s.records, ids[i]))
      ctx.addIssue({
        code: "custom",
        message: "Expedition has no matching records collection",
        path: ["records", ids[i]],
      });
  }
  for (const id of Object.keys(s.records))
    if (!ids.includes(id))
      ctx.addIssue({
        code: "custom",
        message: "Records collection is not linked to an expedition",
        path: ["records", id],
      });
  for (const [id, records] of Object.entries(s.records)) {
    const groups = new Set<string>();
    for (const booking of records.bookings) {
      if (
        !booking.alternativeGroup ||
        !booking.selectedAlternative ||
        isCancelled(booking) ||
        booking.archived
      )
        continue;
      const group = str(booking, "alternativeGroup");
      if (groups.has(group))
        ctx.addIssue({
          code: "custom",
          message: "ניתן לבחור רק הזמנה אחת בכל קבוצת חלופות",
          path: ["records", id, "bookings"],
        });
      groups.add(group);
    }
  }
});
export type State = z.infer<typeof stateSchema>;
export const num = (r: Entry, key: string) => Number(r[key] || 0);
export const str = (r: Entry, key: string) => String(r[key] ?? "");
export function cost(r: Entry, e: Expedition) {
  return (
    num(r, "amount") * (num(r, "rate") || e.rates[str(r, "currency")] || 1)
  );
}
// The summary and category breakdown use the same forecast, including money
// already spent on a cancelled or unselected alternative.
export function bookingCategoryForecast(
  records: Record<Kind, Entry[]>,
  e: Expedition,
) {
  const categories: Record<string, number> = {};
  for (const booking of records.bookings) {
    const retained =
      Math.max(0, num(booking, "paid") - num(booking, "refunded")) *
      (num(booking, "rate") || e.rates[str(booking, "currency")] || 1);
    const included =
      !isCancelled(booking) &&
      (!booking.archived || isExistingBooking(booking)) &&
      (!booking.alternativeGroup || booking.selectedAlternative === true);
    const amount = included ? Math.max(cost(booking, e), retained) : retained;
    if (amount > 0) {
      const category = str(booking, "category") || "Other";
      categories[category] = (categories[category] || 0) + amount;
    }
  }
  return categories;
}
export function totals(records: Record<Kind, Entry[]>, e: Expedition) {
  const currentBookings = records.bookings.filter(
    (b) => !isCancelled(b) && (!b.archived || isExistingBooking(b)),
  );
  const bookings = currentBookings.filter(
    (b) => !b.alternativeGroup || b.selectedAlternative === true,
  );
  const retainedPayment = (b: Entry) =>
    Math.max(0, num(b, "paid") - num(b, "refunded")) *
    (num(b, "rate") || e.rates[str(b, "currency")] || 1);
  const committed = currentBookings
    .filter(isExistingBooking)
    .reduce((s, b) => s + cost(b, e), 0);
  const estimated =
    Object.values(bookingCategoryForecast(records, e)).reduce(
      (sum, amount) => sum + amount,
      0,
    ) +
    records.gear
      .filter((g) => !g.archived && g.ownership === "buy")
      .reduce((s, g) => s + cost(g, e) * Math.max(1, num(g, "quantity")), 0);
  const paid = records.bookings.reduce((s, b) => s + retainedPayment(b), 0);
  // Linked expenses are payments, already represented by the booking. Only unlinked spending adds to the forecast.
  const actual = records.expenses
    .filter(
      (x) => !x.bookingId && !isCancelled(x) && x.expenseKind !== "estimate",
    )
    .reduce((s, x) => s + cost(x, e), 0);
  const estimatedExpenses = records.expenses
    .filter(
      (x) => !x.bookingId && !isCancelled(x) && x.expenseKind === "estimate",
    )
    .reduce((sum, x) => sum + cost(x, e), 0);
  return {
    committed,
    estimated: estimated + actual + estimatedExpenses,
    paid,
    actual,
    remaining:
      e.budget -
      committed -
      actual -
      records.bookings
        .filter(isCancelled)
        .reduce((sum, b) => sum + retainedPayment(b), 0),
    outstanding: currentBookings
      .filter(isExistingBooking)
      .reduce(
        (sum, b) =>
          sum +
          Math.max(
            0,
            cost(b, e) -
              num(b, "paid") *
                (num(b, "rate") || e.rates[str(b, "currency")] || 1),
          ),
        0,
      ),
    refundable: currentBookings
      .filter(
        (b) =>
          isExistingBooking(b) &&
          (b.cancellationPolicy === "Free cancellation" ||
            b.status === "Refundable booking"),
      )
      .reduce((sum, b) => sum + cost(b, e), 0),
    nonrefundable: currentBookings
      .filter(
        (b) =>
          isExistingBooking(b) && b.cancellationPolicy === "Non-refundable",
      )
      .reduce((sum, b) => sum + cost(b, e), 0),
    reserve: e.reserve || 0,
    unknownCosts: bookings.filter(
      (b) => b.amount === undefined || b.amount === "",
    ).length,
    unselectedAlternatives: new Set(
      records.bookings
        .filter(
          (b) =>
            isActive(b) &&
            b.alternativeGroup &&
            !records.bookings.some(
              (other) =>
                isActive(other) &&
                other.alternativeGroup === b.alternativeGroup &&
                other.selectedAlternative === true,
            ),
        )
        .map((b) => str(b, "alternativeGroup")),
    ).size,
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
export function warnings(
  records: Record<Kind, Entry[]>,
  lang: "he" | "en" = "en",
) {
  const out: string[] = [];
  for (const t of records.transport.filter(isActive)) {
    if (!t.date)
      out.push(
        `${t.title}: ${lang === "he" ? "טרם נקבע תאריך מעבר" : "date needs planning"}`,
      );
    if (t.departure && t.arrival && str(t, "arrival") < str(t, "departure"))
      out.push(
        `${t.title}: ${lang === "he" ? "ההגעה קודמת ליציאה; יש לבדוק תאריכים ואזורי זמן" : "arrival precedes departure; verify dates and timezones"}`,
      );
    if (t.buffer && num(t, "buffer") < 120)
      out.push(
        `${t.title}: ${lang === "he" ? "מרווח מעבר קצר משעתיים; יש לבדוק עם המפעיל" : "transfer buffer under 2 hours; verify with operator"}`,
      );
  }
  const booked = records.bookings.filter(
    (x) =>
      isExistingBooking(x) && x.date && x.end && x.category === "Accommodation",
  );
  for (let i = 0; i < booked.length; i++)
    for (let j = i + 1; j < booked.length; j++)
      if (
        str(booked[i], "date") < str(booked[j], "end") &&
        str(booked[j], "date") < str(booked[i], "end")
      )
        out.push(
          `${lang === "he" ? "חפיפת לינות" : "Accommodation overlap"}: ${booked[i].title} / ${booked[j].title}`,
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
