import { expect, it } from "vitest";
import { legacySeed, seed } from "../lib/seed";
import {
  plan2027Update,
  PLAN_VERSION,
  tripBlueprint,
} from "../lib/expedition-2027";
import {
  Entry,
  kinds,
  stateSchema,
  totals,
  bookingCategoryForecast,
} from "../lib/model";
import { isActive, isExistingBooking } from "../lib/booking-status";
import {
  shiftStation,
  tripCalendar,
  taskBlockers,
  marineSafety,
} from "../lib/trip-planning";
import { cancellationAlerts } from "../lib/reservations";
const row = (id: string, extra: Record<string, Entry[string]> = {}): Entry => ({
  id,
  title: id,
  notes: "",
  status: "Planned booking",
  ...extra,
});

it("supplies eight Hebrew stations, all 27 tasks, an editable marine plan and no fictional payments or confirmations", () => {
  const s = seed(),
    r = s.records[s.activeId],
    blueprint = tripBlueprint();
  expect(stateSchema.safeParse(s).success).toBe(true);
  expect(r.segments.filter(isActive)).toHaveLength(8);
  expect(blueprint.tasks).toHaveLength(27);
  expect(
    blueprint.tasks.every(
      (t) =>
        /[א-ת]/.test(t.title) &&
        (t.bookingWindow === "spontaneous" || !!t.date),
    ),
  ).toBe(true);
  expect(
    blueprint.bookings.every(
      (b) => !b.reference && !b.amount && !b.paid && !b.freeCancellationAt,
    ),
  ).toBe(true);
  expect(r.bookings.filter((b) => b.evidence === "user-reported")).toHaveLength(
    2,
  );
  expect(
    r.bookings.filter((b) => b.marine && b.plannedDives === 4),
  ).toHaveLength(1);
  expect(totals(r, s.expeditions[0]).paid).toBe(0);
});
it("migration preserves personal records, all payment/reference fields and locked dates, and is idempotent", () => {
  const before = legacySeed(),
    r = before.records[before.activeId];
  r.bookings.push(
    row("real", {
      status: "Refundable booking",
      reference: "private-reference",
      paid: 70,
      amount: 100,
      destinationId: "antigua",
      category: "Accommodation",
      date: "2027-04-17",
      end: "2027-04-21",
      customField: "retained",
    }),
  );
  r.expenses.push(row("payment", { bookingId: "real", amount: 70 }));
  r.dives.push(row("logged", { status: "Completed", date: "2026-01-01" }));
  r.segments[0].locked = true;
  before.expeditions[0].budget = 24000;
  const original = structuredClone(before),
    after = plan2027Update(before),
    result = after.records[after.activeId];
  expect(before).toEqual(original);
  expect(result.bookings.find((b) => b.id === "real")).toEqual(
    r.bookings.at(-1),
  );
  expect(result.expenses).toEqual(r.expenses);
  expect(result.dives).toEqual(r.dives);
  expect(result.segments.find((s) => s.id === "s1")).toEqual(r.segments[0]);
  expect(
    result.bookings.some((b) => b.id === "nature27-reported-antigua"),
  ).toBe(false);
  for (const k of kinds)
    expect(
      r[k].every((record) => result[k].some((s) => s.id === record.id)),
    ).toBe(true);
  expect(after.expeditions[0].budget).toBe(24000);
  expect(plan2027Update(after)).toEqual(after);
});
it("removes obsolete Belize planning from the active route but retains a real booking and its cost", () => {
  const s = legacySeed(),
    r = s.records[s.activeId];
  r.destinations.push(row("belize", { title: "בליז" }));
  r.segments.push(
    row("belize-stay", {
      destinationId: "belize",
      locked: true,
      date: "2027-04-25",
      end: "2027-04-28",
    }),
  );
  r.tasks.push(row("border", { title: "מעבר גבול לבליז", status: "Done" }));
  r.bookings.push(
    row("belize-paid", {
      title: "לינה בבליז",
      status: "Booked",
      amount: 100,
      paid: 50,
      currency: "ILS",
      reference: "saved",
    }),
  );
  const after = plan2027Update(s),
    updated = after.records[after.activeId];
  expect(updated.destinations.find((d) => d.id === "belize")?.archived).toBe(
    true,
  );
  expect(updated.segments.find((d) => d.id === "belize-stay")?.archived).toBe(
    true,
  );
  expect(updated.tasks.find((d) => d.id === "border")?.status).toBe("Done");
  expect(
    updated.bookings.find((b) => b.id === "belize-paid")?.routeRelevance,
  ).toBe("outside-current-plan");
  expect(totals(updated, after.expeditions[0]).committed).toBe(100);
});
it("calendar respects checkout nights, marks overlapping lodging and treats free days as open planning", () => {
  const s = seed(),
    r = s.records[s.activeId],
    e = s.expeditions[0];
  r.bookings = [
    row("stay", {
      status: "Refundable booking",
      category: "Accommodation",
      date: e.start,
      end: "2027-04-20",
      reference: "proof",
    }),
    row("overlap", {
      status: "Tentative booking",
      category: "Accommodation",
      date: "2027-04-19",
      end: "2027-04-21",
    }),
  ];
  const days = tripCalendar(r, e);
  expect(days).toHaveLength(34);
  expect(days.find((d) => d.date === "2027-04-19")?.overlappingLodging).toBe(
    true,
  );
  expect(
    days.find((d) => d.date === "2027-04-20")?.lodging.map((b) => b.id),
  ).toEqual(["overlap"]);
  expect(days.at(-1)?.needsLodging).toBe(false);
  expect(days.some((d) => !d.stations.length && !d.locked)).toBe(true);
});
it("date shifts update linked recommendations while preserving confirmed bookings, flights, completed and manual tasks", () => {
  const s = seed(),
    r = s.records[s.activeId],
    stop = r.segments.find((s) => s.id === "nature27-stop-pulmo")!;
  r.bookings.push(
    row("confirmed", {
      status: "Confirmed booking",
      destinationId: stop.destinationId,
      date: "2027-05-16",
      end: "2027-05-19",
      amount: 250,
      paid: 80,
    }),
  );
  r.tasks.push(
    row("manual", {
      segmentId: stop.id,
      date: "2027-03-01",
      deadlineKind: "recommended",
      manualDeadline: true,
      scheduleOffsetDays: -10,
    }),
    row("done", {
      segmentId: stop.id,
      status: "Done",
      date: "2027-03-01",
      deadlineKind: "recommended",
      scheduleOffsetDays: -10,
    }),
  );
  const original = structuredClone(s),
    moved = shiftStation(s, stop.id, "2027-05-15"),
    after = moved.records[moved.activeId];
  expect(s).toEqual(original);
  expect(after.bookings).toEqual(r.bookings);
  expect(after.transport).toEqual(r.transport);
  expect(
    after.tasks.find((t) => t.id === "nature27-task-pulmo-book")?.date,
  ).toBe("2027-03-24");
  expect(after.tasks.find((t) => t.id === "manual")?.date).toBe("2027-03-01");
  expect(after.tasks.find((t) => t.id === "done")?.date).toBe("2027-03-01");
  expect(
    shiftStation(moved, stop.id, "2027-05-16").records[s.activeId].tasks.find(
      (t) => t.id === "nature27-task-pulmo-book",
    )?.date,
  ).toBe("2027-03-25");
  stop.locked = true;
  expect(() => shiftStation(s, stop.id, "2027-05-15")).toThrow("נעולה");
});
it("new existing statuses count commitments and alerts, but tentative amounts are never paid automatically or alternatives counted twice", () => {
  const s = seed(),
    r = s.records[s.activeId];
  const free = row("free", {
    status: "Refundable booking",
    category: "Accommodation",
    amount: 100,
    currency: "ILS",
    paid: 25,
    cancellationPolicy: "Free cancellation",
    cancellationVerified: true,
    freeCancellationLocal: "2027-04-10T12:00",
    cancellationTimezone: "UTC",
    freeCancellationAt: "2027-04-10T12:00:00.000Z",
  });
  r.bookings = [
    free,
    row("tentative", {
      status: "Tentative booking",
      amount: 50,
      currency: "ILS",
    }),
    row("option-a", { amount: 1000, alternativeGroup: "flights" }),
    row("option-b", { amount: 2000, alternativeGroup: "flights" }),
  ];
  expect(isExistingBooking(free)).toBe(true);
  expect(totals(r, s.expeditions[0])).toMatchObject({
    committed: 150,
    paid: 25,
    outstanding: 125,
    estimated: 150,
    unselectedAlternatives: 1,
  });
  expect(
    cancellationAlerts(r.bookings, Date.parse("2027-04-04T12:00:00Z")),
  ).toHaveLength(1);
  r.bookings[2].selectedAlternative = true;
  expect(totals(r, s.expeditions[0]).estimated).toBe(1150);
  r.bookings[3].selectedAlternative = true;
  expect(stateSchema.safeParse(s).success).toBe(false);
});
it("retains actual non-refunded spending after cancellation without counting linked expenses twice", () => {
  const s = seed(),
    r = s.records[s.activeId];
  r.bookings = [
    row("cancelled", {
      status: "Cancelled",
      amount: 100,
      paid: 50,
      refunded: 20,
      currency: "ILS",
    }),
  ];
  r.expenses = [
    row("payment", { bookingId: "cancelled", amount: 50, currency: "ILS" }),
  ];
  expect(totals(r, s.expeditions[0])).toMatchObject({
    committed: 0,
    paid: 30,
    estimated: 30,
    actual: 0,
  });
});
it("never assumes a dive-flight interval or operator suitability when times are missing", () => {
  const s = seed(),
    r = s.records[s.activeId];
  expect(marineSafety(r).every((x) => x.message.includes("טרם אומת"))).toBe(
    true,
  );
  const pulmo = r.bookings.find((b) => b.id === "nature27-marine-pulmo-dives")!;
  pulmo.lastDiveAt = "2027-05-18T15:00";
  pulmo.diveTimezone = "America/Mazatlan";
  r.transport = [
    row("flight", {
      type: "Flight",
      date: "2027-05-19",
      departure: "2027-05-19T09:00",
      departureTimezone: "America/Mazatlan",
    }),
  ];
  expect(marineSafety(r).find((x) => x.id === pulmo.id)?.message).toContain(
    "נמוך מסף",
  );
  expect(
    taskBlockers(
      r.tasks.find((t) => t.id === "nature27-task-pulmo-book")!,
      r,
    ),
  ).toContain("nature27-task-pulmo-operators");
  expect(s.expeditions[0].planVersion).toBe(PLAN_VERSION);
});

it("keeps real obligations and paid money in competing reservations while counting estimates separately from actual expenses", () => {
  const s = seed(),
    r = s.records[s.activeId];
  r.bookings = [
    row("a", {
      status: "Refundable booking",
      amount: 100,
      alternativeGroup: "stays",
      selectedAlternative: true,
    }),
    row("b", {
      status: "Tentative booking",
      amount: 80,
      paid: 20,
      alternativeGroup: "stays",
    }),
  ];
  r.expenses = [row("food-plan", { amount: 50, expenseKind: "estimate" })];
  expect(bookingCategoryForecast(r, s.expeditions[0])).toEqual({ Other: 120 });
  expect(totals(r, s.expeditions[0])).toMatchObject({
    committed: 180,
    paid: 20,
    actual: 0,
    estimated: 170,
    outstanding: 160,
  });
});
