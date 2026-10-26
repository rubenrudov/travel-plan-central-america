import { it, expect } from "vitest";
import { seed } from "../lib/seed";
import {
  recalculatePayments,
  newExpeditionRecords,
  shareGear,
} from "../lib/operations";
import { recordSchema } from "../lib/model";
it("recalculates payment totals after removing a linked expense", () => {
  const s = seed(),
    r = s.records[s.activeId];
  r.bookings = [
    {
      id: "b",
      title: "Booking",
      status: "Booked",
      notes: "",
      amount: 100,
      currency: "USD",
      paid: 40,
    },
  ];
  expect(recalculatePayments(r, s.expeditions[0], ["b"]).bookings[0].paid).toBe(
    0,
  );
  r.expenses = [
    {
      id: "p",
      title: "Payment",
      status: "Confirmed",
      notes: "",
      amount: 20,
      currency: "USD",
      bookingId: "b",
    },
  ];
  expect(recalculatePayments(r, s.expeditions[0], ["b"]).bookings[0].paid).toBe(
    20,
  );
});
it("reuses owned equipment while keeping packing expedition specific", () => {
  const s = seed();
  s.records[s.activeId].gear[0] = {
    ...s.records[s.activeId].gear[0],
    ownership: "owned",
    packed: true,
    packing: true,
  };
  s.records.other = newExpeditionRecords(s);
  expect(s.records.other.gear[0].ownership).toBe("owned");
  expect(s.records.other.gear[0].packed).toBe(false);
  const item = { ...s.records[s.activeId].gear[0], condition: "Good" };
  const shared = shareGear(s, s.activeId, item);
  expect(shared.other.gear[0].condition).toBe("Good");
  expect(shared.other.gear[0].packed).toBe(false);
});
it("rejects invalid financial and calendar input in restored data", () => {
  expect(
    recordSchema.safeParse({
      id: "x",
      title: "Bad cost",
      amount: "not-a-number",
    }).success,
  ).toBe(false);
  expect(
    recordSchema.safeParse({ id: "x", title: "Bad date", date: "2027-02-31" })
      .success,
  ).toBe(false);
});
