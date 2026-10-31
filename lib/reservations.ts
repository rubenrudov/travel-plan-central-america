import { DateTime, IANAZone } from "luxon";
import { Entry, Kind, str } from "./model";
import { isActive, isExistingBooking } from "./booking-status";
export function cancellationInstant(local: string, zone: string) {
  if (!(zone === "UTC" || zone.includes("/")) || !IANAZone.isValidZone(zone))
    throw Error("Choose a valid IANA timezone, e.g. America/Guatemala");
  const d = DateTime.fromISO(local, { zone });
  if (
    !d.isValid ||
    d.toFormat("yyyy-MM-dd'T'HH:mm") !== local ||
    d.getPossibleOffsets().length !== 1
  )
    throw Error(
      "Deadline is invalid or ambiguous in this timezone; verify with the property",
    );
  return d.toUTC().toISO()!;
}
export function reminderAt(booking: Entry) {
  if (
    booking.cancellationPolicy !== "Free cancellation" ||
    booking.cancellationVerified !== true ||
    !isActive(booking) ||
    !isExistingBooking(booking) ||
    !booking.freeCancellationAt ||
    !IANAZone.isValidZone(str(booking, "cancellationTimezone"))
  )
    return null;
  const time = DateTime.fromISO(str(booking, "freeCancellationAt"), {
    setZone: true,
  }).setZone(str(booking, "cancellationTimezone"));
  return time.isValid ? time.minus({ weeks: 1 }).toUTC().toISO() : null;
}
export function cancellationAlerts(bookings: Entry[], now = Date.now()) {
  return bookings
    .map((booking) => ({ booking, reminder: reminderAt(booking) }))
    .filter(
      (x) =>
        x.reminder &&
        Date.parse(x.reminder) <= now &&
        Date.parse(str(x.booking, "freeCancellationAt")) > now,
    )
    .sort((a, b) =>
      str(a.booking, "freeCancellationAt").localeCompare(
        str(b.booking, "freeCancellationAt"),
      ),
    );
}
const normalized = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function matchDestination(address: string, destinations: Entry[]) {
  const hay = " " + normalized(address).replace(/[^\p{L}\p{N}]+/gu, " ") + " ";
  const matches = destinations.filter((d) =>
    [d.title, ...str(d, "aliases").split(",")]
      .map((x) => normalized(x.trim()).replace(/[^\p{L}\p{N}]+/gu, " "))
      .filter((x) => x.length >= 3)
      .some((name) => hay.includes(" " + name + " ")),
  );
  return matches.length === 1 ? matches[0].id : null;
}
export function currentStays(
  records: Record<Kind, Entry[]>,
  destinationId: string,
  date: string,
) {
  return records.bookings.filter(
    (b) =>
      b.category === "Accommodation" &&
      b.destinationId === destinationId &&
      isActive(b) &&
      isExistingBooking(b) &&
      !!b.stayAddress &&
      str(b, "date") <= date &&
      str(b, "end") > date,
  );
}
