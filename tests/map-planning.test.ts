import { it, expect } from "vitest";
import { seed } from "../lib/seed";
import {
  connectionArc,
  mapPlan,
  transportMode,
  validPoint,
} from "../lib/map-planning";
import { recordSchema } from "../lib/model";
it("builds linked flight/ferry/driving legs and only dated itinerary fallbacks without inventing transport modes", () => {
  const s = seed(),
    r = s.records[s.activeId];
  r.destinations = [
    {
      id: "a",
      title: "Antigua",
      status: "tentative",
      notes: "",
      mapLat: 14.56,
      mapLng: -90.73,
    },
    {
      id: "b",
      title: "La Paz",
      status: "tentative",
      notes: "",
      mapLat: 24.14,
      mapLng: -110.31,
    },
  ];
  r.transport = [
    {
      id: "flight",
      title: "Flight",
      status: "tentative",
      notes: "",
      type: "Flight",
      fromDestinationId: "a",
      toDestinationId: "b",
    },
    {
      id: "ferry",
      title: "Ferry",
      status: "tentative",
      notes: "",
      type: "Ferry",
      origin: "La Paz",
      destination: "Antigua",
    },
    {
      id: "car",
      title: "Car",
      status: "tentative",
      notes: "",
      type: "Car",
      fromDestinationId: "a",
      toDestinationId: "b",
    },
  ];
  r.segments = [
    {
      id: "s1",
      title: "A",
      status: "tentative",
      notes: "",
      destinationId: "a",
    },
    {
      id: "s2",
      title: "B",
      status: "tentative",
      notes: "",
      destinationId: "b",
    },
  ];
  const result = mapPlan(r);
  expect(result.legs.map((l) => l.mode)).toEqual(["flight", "ferry", "car"]);
  expect(result.legs.every((l) => !l.inferred)).toBe(true);
});
it("shows missing locations and refuses stale address coordinates", () => {
  const s = seed(),
    r = s.records[s.activeId];
  r.bookings = [
    {
      id: "b",
      title: "Hostel",
      status: "Booked",
      notes: "",
      category: "Accommodation",
      stayAddress: "New address",
      mapQuery: "Old address",
      mapLat: 14,
      mapLng: -90,
    },
  ];
  const p = mapPlan(r);
  expect(p.targets.find((t) => t.kind === "bookings")?.point).toBeNull();
  expect(p.unresolved.length).toBeGreaterThan(0);
});
it("does not match ambiguous destination names or assume airport coordinates from a city label", () => {
  const s = seed(),
    r = s.records[s.activeId];
  r.destinations = [
    {
      id: "a",
      title: "San Pedro",
      status: "tentative",
      notes: "",
      mapLat: 14,
      mapLng: -90,
    },
    {
      id: "b",
      title: "San Pedro",
      status: "tentative",
      notes: "",
      mapLat: 18,
      mapLng: -91,
    },
  ];
  r.transport = [
    {
      id: "leg",
      title: "Transfer",
      status: "tentative",
      notes: "",
      origin: "San Pedro",
      destination: "San Pedro Airport",
      type: "Transfer",
    },
  ];
  const plan = mapPlan(r);
  expect(plan.legs).toHaveLength(0);
  expect(
    plan.targets.some(
      (t) => t.query === "San Pedro Airport" && t.point === null,
    ),
  ).toBe(true);
});
it("uses short dotted arcs with exact endpoints, including across the dateline", () => {
  const path = connectionArc([10, 179], [12, -179]);
  expect(path[0]).toEqual([10, 179]);
  expect(path.at(-1)).toEqual([12, 181]);
  expect(
    Math.max(...path.map((p) => p[1])) - Math.min(...path.map((p) => p[1])),
  ).toBeLessThan(5);
  expect(path[24][0]).toBeGreaterThan(11);
});
it("validates negative coordinates, rejects partial/out-of-range pins and leaves unchosen transport unspecified", () => {
  expect(
    recordSchema.safeParse({
      id: "x",
      title: "Place",
      mapLat: 24.14,
      mapLng: -110.31,
    }).success,
  ).toBe(true);
  expect(
    recordSchema.safeParse({ id: "x", title: "Place", mapLat: 91, mapLng: 2 })
      .success,
  ).toBe(false);
  expect(
    recordSchema.safeParse({ id: "x", title: "Place", mapLat: 14 }).success,
  ).toBe(false);
  expect(validPoint([0, 0])).toBe(true);
  expect(transportMode("")).toBe("other");
});
