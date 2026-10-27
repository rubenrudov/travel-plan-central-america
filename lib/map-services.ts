import { Point, validPoint } from "./map-planning";
export type GeoMatch = { label: string; point: Point };
export type RoadRoute = { points: Point[]; distance: number; duration: number };
let lastLookup = 0;
let queue: Promise<unknown> = Promise.resolve();
function cacheGet<T>(key: string, ttl: number): T | null {
  try {
    const item = JSON.parse(localStorage.getItem(key) || "null");
    return item && Date.now() - item.at < ttl ? item.value : null;
  } catch {
    return null;
  }
}
function cacheSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* The map still works if browser storage is full. */
  }
}
export function searchLocation(query: string): Promise<GeoMatch[]> {
  const key = "adventure-geo-v1:" + query;
  const cached = cacheGet<GeoMatch[]>(key, 180 * 86400000);
  if (cached) return Promise.resolve(cached);
  const task = queue.then(async () => {
    await new Promise((r) =>
      setTimeout(r, Math.max(0, 1100 - (Date.now() - lastLookup))),
    );
    lastLookup = Date.now();
    const response = await fetch(
      "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
          q: query,
          format: "jsonv2",
          limit: "4",
          "accept-language": "en",
        }),
      { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok)
      throw Error(
        "Location search is unavailable. Try again later or place the pin manually.",
      );
    const json: unknown = await response.json();
    if (!Array.isArray(json)) throw Error("Invalid location response");
    const matches = json.flatMap((row) => {
      const point = [Number(row.lat), Number(row.lon)];
      return validPoint(point) && typeof row.display_name === "string"
        ? [{ label: row.display_name, point }]
        : [];
    });
    cacheSet(key, matches);
    return matches;
  });
  queue = task.catch(() => undefined);
  return task;
}
export async function drivingRoute(
  from: Point,
  to: Point,
  signal: AbortSignal,
): Promise<RoadRoute> {
  const key = "adventure-road-v1:" + JSON.stringify([from, to]);
  const cached = cacheGet<RoadRoute>(key, 7 * 86400000);
  if (cached) return cached;
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=false`,
    { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) },
  );
  if (!response.ok) throw Error("Road routing unavailable");
  const json = await response.json();
  const route = json.routes?.[0];
  if (
    json.code !== "Ok" ||
    !Array.isArray(route?.geometry?.coordinates) ||
    json.waypoints?.some((w: { distance: number }) => w.distance > 5000)
  )
    throw Error("No usable road route found");
  const points = route.geometry.coordinates.map((p: number[]) => [p[1], p[0]]);
  if (
    points.length < 2 ||
    !points.every(validPoint) ||
    !Number.isFinite(route.distance) ||
    !Number.isFinite(route.duration)
  )
    throw Error("Invalid road geometry");
  const result = { points, distance: route.distance, duration: route.duration };
  cacheSet(key, result);
  return result;
}
