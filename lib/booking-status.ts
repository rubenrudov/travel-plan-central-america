import type { Entry } from "./model";
export const bookingStatuses = [
  "Confirmed booking",
  "Refundable booking",
  "Tentative booking",
  "Awaiting confirmation",
  "Planned booking",
  "Optional booking",
  "Cancelled",
  "Replaced",
] as const;
export const bookingStatusLabels: Record<string, string> = {
  "Confirmed booking": "הוזמן ואושר",
  "Refundable booking": "הוזמן עם ביטול חינם",
  "Tentative booking": "הוזמן טנטטיבית",
  "Awaiting confirmation": "ממתין לאישור",
  "Planned booking": "מתוכנן, טרם הוזמן",
  "Optional booking": "אופציונלי / ספונטני",
  Cancelled: "בוטל",
  Replaced: "הוחלף",
  Booked: "הוזמן ואושר",
  Paid: "הוזמן ושולם",
  Researching: "במחקר — טרם הוזמן",
  Idea: "רעיון",
  Shortlisted: "ברשימה לבדיקה",
  "Ready to book": "מוכן להזמנה",
};
export const isCancelled = (r: Entry) =>
  ["Cancelled", "Replaced"].includes(r.status);
export const isExistingBooking = (r: Entry) =>
  !isCancelled(r) &&
  [
    "Booked",
    "Paid",
    "Confirmed booking",
    "Refundable booking",
    "Tentative booking",
  ].includes(r.status);
export const isActive = (r: Entry) => !r.archived && !isCancelled(r);
export const missingConfirmation = (r: Entry) =>
  isExistingBooking(r) &&
  (!r.reference ||
    !r.date ||
    (r.category === "Accommodation" && !r.end) ||
    r.evidence === "user-reported");
