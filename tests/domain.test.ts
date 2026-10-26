import { describe, it, expect } from "vitest";
import { seed } from "../lib/seed";
import {
  totals,
  readiness,
  impacts,
  stateSchema,
  warnings,
  Entry,
} from "../lib/model";
const s = seed(),
  e = s.expeditions[0];
const row = (
  id: string,
  extra: Record<string, string | number | boolean | string[]>,
): Entry => ({ id, title: id, status: "tentative", notes: "", ...extra });
describe("expedition planning integrity", () => {
  it("seeds only unconfirmed records without invented payments or references", () => {
    expect(stateSchema.safeParse(s).success).toBe(true);
    expect(
      s.records[s.activeId].bookings.every((b) => !b.reference && !b.paid),
    ).toBe(true);
    expect(totals(s.records[s.activeId], e).committed).toBe(0);
  });
  it("converts booking totals once without double counting linked payments", () => {
    const r = structuredClone(s.records[s.activeId]);
    r.bookings = [
      row("b", { status: "Booked", amount: 100, currency: "USD", paid: 40 }),
    ];
    r.expenses = [
      row("p", { amount: 40, currency: "USD", bookingId: "b" }),
      row("food", { amount: 10, currency: "ILS" }),
    ];
    const total = totals(r, e);
    expect(total.committed).toBe(370);
    expect(total.paid).toBe(148);
    expect(total.estimated).toBe(380);
    expect(total.remaining).toBe(24620);
  });
  it("excludes cancelled commitments and owned gear from shopping estimates", () => {
    const r = structuredClone(s.records[s.activeId]);
    r.bookings = [
      row("b", { status: "Cancelled", amount: 1000, currency: "ILS" }),
    ];
    r.gear = [
      row("g", { ownership: "owned", amount: 1000 }),
      row("g2", { ownership: "buy", amount: 50, quantity: 2, currency: "ILS" }),
    ];
    expect(totals(r, e).estimated).toBe(100);
  });
  it("does not count planned dives as logged dives", () => {
    expect(
      readiness([
        row("d", { status: "Planned", date: "2027-03-10" }),
        row("d2", { status: "Completed", date: "2026-11-01" }),
      ]),
    ).toEqual({ count: 1, last: "2026-11-01" });
  });
  it("surfaces dependent bookings without mutating their dates", () => {
    const r = structuredClone(s.records[s.activeId]);
    const segment = r.segments[0];
    r.bookings.push(
      row("confirmed", {
        status: "Booked",
        destinationId: "antigua",
        date: "2027-04-17",
      }),
    );
    expect(impacts(segment, r).some((x) => x.id === "confirmed")).toBe(true);
    expect(r.bookings.at(-1)?.date).toBe("2027-04-17");
  });
  it("flags missing connection dates and impossible chronology", () => {
    const r = structuredClone(s.records[s.activeId]);
    r.transport = [
      row("l", {
        departure: "2027-05-01T12:00",
        arrival: "2027-05-01T10:00",
        buffer: 60,
      }),
    ];
    expect(warnings(r)).toHaveLength(3);
  });
  it("rejects invalid backup references", () => {
    expect(stateSchema.safeParse({ ...s, activeId: "missing" }).success).toBe(
      false,
    );
  });
});
