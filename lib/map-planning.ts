import { isActive } from "./booking-status";
import { Entry, Kind, str } from "./model";
export type Point = [number, number];
export type MapTarget = {
  key: string;
  kind: "destinations" | "bookings" | "transport";
  id: string;
  side?: "from" | "to";
  title: string;
  query: string;
  point: Point | null;
  record: Entry;
};
export type MapLeg = {
  id: string;
  title: string;
  mode: "flight" | "ferry" | "car" | "other";
  from: Point;
  to: Point;
  record?: Entry;
  inferred: boolean;
};
export function validPoint(value: unknown): value is Point {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((x) => typeof x === "number" && Number.isFinite(x)) &&
    Math.abs(value[0]) <= 85 &&
    Math.abs(value[1]) <= 180
  );
}
export function normalizeLocation(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function targetFields(side?: "from" | "to") {
  return side
    ? {
        lat: side + "MapLat",
        lng: side + "MapLng",
        query: side + "MapQuery",
        label: side + "MapLabel",
        source: side + "MapSource",
      }
    : {
        lat: "mapLat",
        lng: "mapLng",
        query: "mapQuery",
        label: "mapLabel",
        source: "mapSource",
      };
}
function pointFor(
  record: Entry,
  query: string,
  side?: "from" | "to",
): Point | null {
  const fields = targetFields(side),
    point = [record[fields.lat], record[fields.lng]];
  return validPoint(point) &&
    (!record[fields.query] || record[fields.query] === query)
    ? point
    : null;
}
export function transportMode(type: string): MapLeg["mode"] {
  return /^(flight|plane)$/i.test(type)
    ? "flight"
    : /^(boat|ferry)$/i.test(type)
      ? "ferry"
      : /^(car|rental car|transfer|shuttle|bus)$/i.test(type)
        ? "car"
        : "other";
}
export function mapPlan(records: Record<Kind, Entry[]>) {
  const targets: MapTarget[] = [],
    unresolved: string[] = [];
  const destinations = records.destinations.filter(isActive);
  for (const d of destinations) {
    const query = [d.title, str(d, "country")].filter(Boolean).join(", ");
    targets.push({
      key: "destinations:" + d.id,
      kind: "destinations",
      id: d.id,
      title: d.title,
      query,
      point: pointFor(d, query),
      record: d,
    });
  }
  for (const b of records.bookings.filter(
    (b) => b.category === "Accommodation" && isActive(b) && b.stayAddress,
  )) {
    const query = str(b, "stayAddress");
    targets.push({
      key: "bookings:" + b.id,
      kind: "bookings",
      id: b.id,
      title: str(b, "propertyName") || b.title,
      query,
      point: pointFor(b, query),
      record: b,
    });
  }
  const endpoint = (leg: Entry, side: "from" | "to") => {
    const id = str(
        leg,
        side === "from" ? "fromDestinationId" : "toDestinationId",
      ),
      text = str(leg, side === "from" ? "origin" : "destination");
    let match = id ? destinations.find((d) => d.id === id) : undefined;
    if (!id && text) {
      const candidates = destinations.filter((d) =>
        [d.title, ...str(d, "aliases").split(",")].some(
          (alias) => normalizeLocation(alias) === normalizeLocation(text),
        ),
      );
      if (candidates.length === 1) match = candidates[0];
    }
    if (match)
      return targets.find(
        (t) => t.kind === "destinations" && t.id === match.id,
      )!;
    if (!text) {
      unresolved.push(leg.title + ": " + side);
      return null;
    }
    const target: MapTarget = {
      key: `transport:${leg.id}:${side}`,
      kind: "transport",
      id: leg.id,
      side,
      title: leg.title + " · " + (side === "from" ? "Origin" : "Destination"),
      query: text,
      point: pointFor(leg, text, side),
      record: leg,
    };
    targets.push(target);
    return target;
  };
  const legs: MapLeg[] = [];
  const linkedPairs = new Set<string>();
  for (const leg of records.transport.filter(isActive)) {
    const from = endpoint(leg, "from"),
      to = endpoint(leg, "to");
    if (from && to) {
      linkedPairs.add(from.key + ">" + to.key);
      if (
        from.point &&
        to.point &&
        from.point.some((v, i) => v !== to.point![i])
      )
        legs.push({
          id: leg.id,
          title: leg.title,
          mode: transportMode(str(leg, "type")),
          from: from.point,
          to: to.point,
          record: leg,
          inferred: false,
        });
      else if (!from.point || !to.point) unresolved.push(leg.title);
    }
  }
  const sequence = records.segments
    .filter(isActive)
    .map((s) =>
      targets.find(
        (t) => t.kind === "destinations" && t.id === s.destinationId,
      ),
    )
    .filter((t): t is MapTarget => !!t);
  for (let i = 1; i < sequence.length; i++) {
    const from = sequence[i - 1],
      to = sequence[i];
    if (from.key === to.key || linkedPairs.has(from.key + ">" + to.key))
      continue;
    if (from.point && to.point)
      legs.push({
        id: "itinerary:" + i,
        title: from.title + " → " + to.title,
        mode: "other",
        from: from.point,
        to: to.point,
        inferred: true,
      });
  }
  return { targets, legs, unresolved: [...new Set(unresolved)] };
}
// A quadratic planning arc, deliberately separate from real road geometry.
export function connectionArc(from: Point, to: Point): Point[] {
  let endLng = to[1];
  while (endLng - from[1] > 180) endLng -= 360;
  while (endLng - from[1] < -180) endLng += 360;
  const dx = endLng - from[1],
    dy = to[0] - from[0];
  const control: Point = [
    Math.max(-85, Math.min(85, (from[0] + to[0]) / 2 + Math.abs(dx) * 0.18)),
    (from[1] + endLng) / 2 - dy * 0.12,
  ];
  return Array.from({ length: 49 }, (_, i) => {
    const t = i / 48,
      u = 1 - t;
    return [
      u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
      u * u * from[1] + 2 * u * t * control[1] + t * t * endLng,
    ] as Point;
  });
}
export function bearing(from: Point, to: Point) {
  return (
    (Math.atan2(
      (to[1] - from[1]) * Math.cos(((from[0] + to[0]) * Math.PI) / 360),
      to[0] - from[0],
    ) *
      180) /
    Math.PI
  );
}
