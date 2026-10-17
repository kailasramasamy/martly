export interface Drive {
  km: number;
  minutes: number;
}

type Point = { lat: number; lng: number };

// Shoppers a few steps apart share an answer: origins are rounded to ~100 m and kept for 10 minutes
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; drives: Map<string, Drive> }>();

const cacheKey = (origin: Point, ids: string[]) => `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}|${[...ids].sort().join(",")}`;

function remember(key: string, drives: Map<string, Drive>) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), drives });
}

/** One Routes API matrix call: drive from the shopper to each store. Null when Google is unavailable */
async function fetchMatrix(origin: Point, stores: { id: string; lat: number; lng: number }[]): Promise<Map<string, Drive> | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const waypoint = (p: Point) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });
  const res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "destinationIndex,distanceMeters,duration,condition" },
    body: JSON.stringify({ origins: [waypoint(origin)], destinations: stores.map(waypoint), travelMode: "DRIVE" }),
  }).catch((err: unknown) => {
    // Network failure: fall back to straight-line distance rather than failing the store list
    if (err instanceof TypeError) return null;
    throw err;
  });
  if (!res?.ok) return null;
  const rows = (await res.json()) as { destinationIndex: number; distanceMeters?: number; duration?: string; condition?: string }[];
  const drives = new Map<string, Drive>();
  for (const r of rows) {
    if (r.condition !== "ROUTE_EXISTS" || r.distanceMeters == null) continue;
    drives.set(stores[r.destinationIndex].id, { km: Math.round(r.distanceMeters / 100) / 10, minutes: Math.max(1, Math.round(parseInt(r.duration ?? "0", 10) / 60)) });
  }
  return drives;
}

/** Driving distance and time from the shopper to each store, cached per neighbourhood */
export async function drivingDistances(origin: Point, stores: { id: string; lat: number; lng: number }[]): Promise<Map<string, Drive>> {
  if (stores.length === 0) return new Map();
  const key = cacheKey(origin, stores.map((s) => s.id));
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.drives;
  const drives = await fetchMatrix(origin, stores);
  if (!drives) return new Map();
  remember(key, drives);
  return drives;
}
