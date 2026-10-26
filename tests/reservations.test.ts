import { it, expect } from "vitest";
import {
  cancellationInstant,
  reminderAt,
  cancellationAlerts,
  matchDestination,
  currentStays,
} from "../lib/reservations";
import { seed } from "../lib/seed";
import { recordSchema, Entry } from "../lib/model";
import {
  parseReservation,
  providerForSender,
  extractMailText,
} from "../supabase/functions/_shared/parse";
const booking: Entry = {
  id: "b",
  title: "Test stay",
  status: "Booked",
  notes: "",
  category: "Accommodation",
  cancellationPolicy: "Free cancellation",
  freeCancellationLocal: "2027-04-10T18:00",
  cancellationTimezone: "America/Guatemala",
  freeCancellationAt: "2027-04-11T00:00:00.000Z",
  cancellationVerified: true,
};
it("calculates exact local deadlines and a seven-calendar-day reminder across DST", () => {
  expect(cancellationInstant("2027-04-10T18:00", "America/Guatemala")).toBe(
    booking.freeCancellationAt,
  );
  const d = {
    ...booking,
    freeCancellationAt: "2027-03-29T11:00:00Z",
    cancellationTimezone: "Europe/London",
  };
  expect(reminderAt(d)).toBe("2027-03-22T12:00:00.000Z");
});
it("rejects ambiguous and nonexistent local deadlines", () => {
  expect(() =>
    cancellationInstant("2027-03-14T02:30", "America/New_York"),
  ).toThrow();
  expect(() =>
    cancellationInstant("2027-11-07T01:30", "America/New_York"),
  ).toThrow();
  expect(() => cancellationInstant("2027-04-10T18:00", "CST")).toThrow();
});
it("does not notify for cancelled, nonrefundable, expired or unverified policies", () => {
  for (const changes of [
    { status: "Cancelled" },
    { cancellationPolicy: "Non-refundable" },
    { cancellationVerified: false },
  ])
    expect(reminderAt({ ...booking, ...changes } as Entry)).toBeNull();
  expect(
    cancellationAlerts([booking], Date.parse("2027-04-11T00:00:00Z")),
  ).toHaveLength(0);
  expect(
    cancellationAlerts([booking], Date.parse("2027-04-08T00:00:00Z")),
  ).toHaveLength(1);
  expect(
    recordSchema.safeParse({
      ...booking,
      cancellationTimezone: "UTC",
      freeCancellationLocal: "2027-04-10T18:00",
    }).success,
  ).toBe(false);
});
it("matches only one complete destination name or alias and never overwrites ambiguous matches", () => {
  const d = seed().records["guatemala-baja-2027"].destinations;
  expect(matchDestination("Calle 5, Antigua, Guatemala", d)).toBe("antigua");
  expect(matchDestination("Road from Antigua to Lake Atitlán", d)).toBeNull();
  expect(matchDestination("Antiguana Hotel", d)).toBeNull();
});
it("derives dated current accommodation and excludes checkout day", () => {
  const r = seed().records["guatemala-baja-2027"];
  r.bookings = [
    {
      ...booking,
      destinationId: "antigua",
      stayAddress: "Calle 5, Antigua",
      date: "2027-04-17",
      end: "2027-04-20",
    },
  ];
  expect(currentStays(r, "antigua", "2027-04-19")).toHaveLength(1);
  expect(currentStays(r, "antigua", "2027-04-20")).toHaveLength(0);
});
it("parses labeled confirmations without guessing ambiguous dates or cancellation times", () => {
  const parsed = parseReservation(
    "Your booking at Sample Hostel is confirmed",
    "Booking reference: ABC1234\nCheck-in: 17 April 2027\nCheck-out: 2027-04-21\nAddress: Calle 5, Antigua, Guatemala\nFree cancellation until April 10",
    "Booking.com",
  );
  expect(parsed.reference).toBe("ABC1234");
  expect(parsed.date).toBe("2027-04-17");
  expect(parsed.end).toBe("2027-04-21");
  expect(parsed.cancellationVerified).toBe(false);
  expect(parsed.freeCancellationAt).toBeUndefined();
  expect(
    parseReservation("Booking", "Check-in: 04/05/2027", "Hostelworld").date,
  ).toBe("");
});
it("does not trust display names or lookalike sender domains", () => {
  expect(providerForSender("Booking.com <attacker@example.com>")).toBeNull();
  expect(providerForSender("x@booking.com.attacker.test")).toBeNull();
  expect(
    providerForSender("Reservations <noreply@mailer.hostelworld.com>"),
  ).toBe("Hostelworld");
  expect(
    extractMailText({
      mimeType: "text/plain",
      body: { data: btoa("Booking reference: ABC1234") },
    }),
  ).toContain("ABC1234");
});
it("extracts an explicit cutoff and timezone without treating conditional policy text as a cancellation", () => {
  const parsed = parseReservation(
    "Your booking at Sample Hostel is confirmed",
    "Free cancellation before 2027-04-10 at 11:59 PM America/Guatemala\nAfter that the booking is non-refundable. If your reservation is cancelled, fees apply.",
    "Booking.com",
  );
  expect(parsed.freeCancellationLocal).toBe("2027-04-10T23:59");
  expect(parsed.cancellationTimezone).toBe("America/Guatemala");
  expect(parsed.cancellationPolicy).toBe("Free cancellation");
  expect(parsed.status).toBe("Booked");
});
it("does not turn conditional cancellation text into a cancelled reservation", () => {
  expect(
    parseReservation(
      "Booking confirmation",
      "If your reservation is cancelled, a fee may apply.",
      "Booking.com",
    ).status,
  ).toBe("Booked");
  expect(
    parseReservation(
      "Cancellation confirmed",
      "Booking reference: ABC1234",
      "Hostelworld",
    ).status,
  ).toBe("Cancelled");
});
it("does not borrow a missing arrival date from the checkout field or choose between different cutoff lines", () => {
  expect(
    parseReservation(
      "Booking",
      "Check-in:\nCheck-out: 2027-04-21",
      "Booking.com",
    ).date,
  ).toBe("");
  expect(
    parseReservation(
      "Booking",
      "Check-in:\n17 April 2027\nCheck-out:\n21 April 2027",
      "Booking.com",
    ).date,
  ).toBe("2027-04-17");
  expect(
    parseReservation(
      "Booking",
      "Free cancellation until 2027-04-10 at 18:00 America/Guatemala\nFree cancellation until 2027-04-11 at 18:00 America/Guatemala",
      "Booking.com",
    ).freeCancellationLocal,
  ).toBe("");
});
