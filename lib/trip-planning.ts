import { DateTime } from "luxon";
import { Entry, Expedition, Kind, State, str, num, stateSchema } from "./model";
import { isActive, isExistingBooking } from "./booking-status";
export type Records = Record<Kind, Entry[]>;
export function datesBetween(start: string, end: string) {
  const days: string[] = [];
  let cursor = DateTime.fromISO(start, { zone: "UTC" });
  const last = DateTime.fromISO(end, { zone: "UTC" });
  if (!cursor.isValid || !last.isValid || last < cursor) return days;
  for (
    let i = 0;
    cursor <= last && i < 366;
    i++, cursor = cursor.plus({ days: 1 })
  )
    days.push(cursor.toISODate()!);
  return days;
}
export function tripCalendar(records: Records, expedition: Expedition) {
  return datesBetween(expedition.start, expedition.end).map((date) => {
    const stations = records.segments.filter(
      (s) => isActive(s) && str(s, "date") <= date && str(s, "end") > date,
    );
    const bookings = records.bookings.filter(
      (b) =>
        isActive(b) &&
        b.date &&
        str(b, "date") <= date &&
        (b.end ? str(b, "end") > date : str(b, "date") === date),
    );
    const lodging = bookings.filter(
      (b) => b.category === "Accommodation" && isExistingBooking(b),
    );
    const reported = records.bookings.filter(
      (b) =>
        isActive(b) &&
        b.evidence === "user-reported" &&
        !b.date &&
        stations.some((s) => s.destinationId === b.destinationId),
    );
    const transfers = records.transport.filter(
      (t) => isActive(t) && t.date === date,
    );
    const needsLodging = date < expedition.end;
    const locked =
      stations.some((s) => !!s.locked) ||
      lodging.some((b) => b.evidence !== "user-reported" && !!b.reference);
    return {
      date,
      stations,
      bookings,
      lodging,
      reported,
      transfers,
      needsLodging,
      locked,
      missingLodging: needsLodging && !lodging.length,
      overlappingLodging: lodging.length > 1,
      stationOverlap:
        new Set(
          stations
            .filter((s) => s.type === "Stay" || s.type === "Buffer")
            .map((s) => s.destinationId),
        ).size > 1,
    };
  });
}
export function taskBlockers(task: Entry, records: Records) {
  const dependencies = Array.isArray(task.dependencies)
    ? task.dependencies
    : [];
  return dependencies.filter(
    (id) =>
      !records.tasks.some((t) => t.id === id && t.status === "Done") &&
      !records.bookings.some((b) => b.id === id && isExistingBooking(b)),
  );
}
export function urgentTasks(records: Records, today: string) {
  return records.tasks
    .filter(
      (t) =>
        isActive(t) &&
        !["Done", "Deferred"].includes(t.status) &&
        (!t.postponedUntil || str(t, "postponedUntil") <= today) &&
        t.bookingWindow !== "spontaneous",
    )
    .sort(
      (a, b) =>
        Number(taskBlockers(a, records).length > 0) -
          Number(taskBlockers(b, records).length > 0) ||
        (str(a, "date") || "9999").localeCompare(str(b, "date") || "9999") ||
        Number(b.priority === "High") - Number(a.priority === "High"),
    );
}
/** Shift a flexible station and recommended route-relative tasks only. Never shift bookings or confirmed transport. */
export function shiftStation(
  state: State,
  segmentId: string,
  date: string,
): State {
  const next = structuredClone(state),
    records = next.records[next.activeId];
  const segment = records.segments.find((s) => s.id === segmentId);
  if (
    !segment ||
    !isActive(segment) ||
    segment.locked ||
    ["Confirmed", "Booked", "Paid"].includes(segment.status)
  )
    throw Error("התחנה נעולה; יש לפתוח אותה לעריכה במפורש לפני שינוי תאריכים.");
  const start = DateTime.fromISO(str(segment, "date"), { zone: "UTC" }),
    target = DateTime.fromISO(date, { zone: "UTC" });
  if (!start.isValid || !target.isValid) throw Error("יש להזין תאריך תקין.");
  const delta = target.diff(start, "days").days;
  segment.date = date;
  if (segment.end)
    segment.end = DateTime.fromISO(str(segment, "end"), { zone: "UTC" })
      .plus({ days: delta })
      .toISODate()!;
  const expedition = next.expeditions.find((e) => e.id === next.activeId)!;
  if (date < expedition.start || str(segment, "end") > expedition.end)
    throw Error(
      "התאריכים מחוץ לגבולות המסע. אפשר לערוך את גבולות המסע בהגדרות.",
    );
  records.tasks = rescheduleTasks(records.tasks, segmentId, delta, date);
  records.segments.sort((a, b) => str(a, "date").localeCompare(str(b, "date")));
  return stateSchema.parse(next);
}
export function rescheduleTasks(
  tasks: Entry[],
  segmentId: string,
  delta: number,
  start: string,
) {
  return tasks.map((task) => {
    if (
      task.archived ||
      task.segmentId !== segmentId ||
      task.deadlineKind !== "recommended" ||
      task.manualDeadline ||
      ["Done", "Cancelled"].includes(task.status)
    )
      return task;
    const next: Entry = { ...task, routeStart: start };
    if (typeof task.scheduleOffsetDays === "number")
      next.date = DateTime.fromISO(start, { zone: "UTC" })
        .plus({ days: task.scheduleOffsetDays })
        .toISODate()!;
    else if (task.bookingWindow === "spontaneous" && task.date)
      next.date = DateTime.fromISO(str(task, "date"), { zone: "UTC" })
        .plus({ days: delta })
        .toISODate()!;
    return next;
  });
}
export function marineSafety(records: Records) {
  const flights = records.transport.filter(
    (t) => isActive(t) && t.type === "Flight",
  );
  const out: { id: string; message: string }[] = [];
  for (const b of records.bookings.filter(
    (b) => isActive(b) && b.marine && b.category === "Diving",
  )) {
    const related = flights.filter(
      (f) => !b.date || !f.date || str(f, "date") >= str(b, "date"),
    );
    const dive =
      b.lastDiveAt && b.diveTimezone
        ? DateTime.fromISO(str(b, "lastDiveAt"), {
            zone: str(b, "diveTimezone"),
          })
        : null;
    const flight = related
      .map((f) => ({
        record: f,
        time:
          f.departure && f.departureTimezone
            ? DateTime.fromISO(str(f, "departure"), {
                zone: str(f, "departureTimezone"),
              })
            : null,
      }))
      .filter(
        (f) =>
          f.time?.isValid &&
          (!dive?.isValid || f.time.toMillis() >= dive.toMillis()),
      )
      .sort((a, b) => a.time!.toMillis() - b.time!.toMillis())[0];
    const threshold = num(b, "minNoFlyHours") || 24;
    if (!dive?.isValid || !flight?.time?.isValid)
      out.push({
        id: b.id,
        message: `${b.title}: חסרים מועד הצלילה האחרונה, שעת טיסה או אזורי זמן; מרווח הבטיחות טרם אומת.`,
      });
    else {
      const hours = flight.time.diff(dive, "hours").hours;
      out.push({
        id: b.id,
        message: `${b.title}: ${hours.toFixed(1)} שעות עד הטיסה הבאה בעלת שעה ידועה. ${hours < threshold ? "נמוך מסף התכנון שהוגדר" : "עומד בסף התכנון שהוגדר בלבד"} (${threshold} שעות); יש לוודא את כל הטיסות ואת הנחיות המפעיל לפי פרופיל הצלילות.`,
      });
    }
  }
  return out;
}
