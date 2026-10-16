import { haversine } from "../../lib/geo.js";

/** One delivery to place on a trip; coordinates are missing for addresses that were never geocoded */
export interface PlanStop {
  id: string;
  lat: number | null;
  lng: number | null;
  pincode: string | null;
  address: string | null;
}

export interface LatLng { lat: number; lng: number }

export interface PlannedGroup {
  /** In delivery order */
  stops: PlanStop[];
  areaLabel: string;
}

export interface PlanResult {
  groups: PlannedGroup[];
  /** Orders that didn't fit the fleet (more than riders × trips × orders per trip) */
  overflow: PlanStop[];
}

const located = (s: PlanStop): s is PlanStop & LatLng => s.lat !== null && s.lng !== null;

/** Located stops by bearing from the store, starting after the widest empty arc so no neighbourhood is cut in two */
function sweepOrder(stops: (PlanStop & LatLng)[], origin: LatLng): PlanStop[] {
  if (stops.length < 2) return stops;
  const withAngle = stops
    .map((s) => ({ s, a: Math.atan2(s.lat - origin.lat, s.lng - origin.lng) }))
    .sort((x, y) => x.a - y.a);
  let start = 0;
  let widest = -1;
  withAngle.forEach((cur, i) => {
    const prev = withAngle[(i - 1 + withAngle.length) % withAngle.length];
    const gap = (cur.a - prev.a + 2 * Math.PI) % (2 * Math.PI);
    if (gap > widest) { widest = gap; start = i; }
  });
  return [...withAngle.slice(start), ...withAngle.slice(0, start)].map((x) => x.s);
}

/** Unlocated stops grouped by pincode, then address, so each locality stays together */
function pincodeOrder(stops: PlanStop[]): PlanStop[] {
  return [...stops].sort((a, b) => (a.pincode ?? "~").localeCompare(b.pincode ?? "~") || (a.address ?? "").localeCompare(b.address ?? ""));
}

/** Cuts a sequence into `parts` chunks whose sizes differ by at most one (17 into 3 → 6, 6, 5) */
export function balancedChunks<T>(items: T[], parts: number): T[][] {
  const chunks: T[][] = [];
  let at = 0;
  for (let i = 0; i < parts; i++) {
    const size = Math.ceil((items.length - at) / (parts - i));
    chunks.push(items.slice(at, at + size));
    at += size;
  }
  return chunks.filter((c) => c.length > 0);
}

/** Nearest-next from the store for located stops; unlocated ones follow, by pincode */
export function routeOrder(stops: PlanStop[], origin: LatLng): PlanStop[] {
  const pending = stops.filter(located);
  const ordered: PlanStop[] = [];
  let here = origin;
  while (pending.length) {
    let best = 0;
    pending.forEach((s, i) => {
      if (haversine(here.lat, here.lng, s.lat, s.lng) < haversine(here.lat, here.lng, pending[best].lat, pending[best].lng)) best = i;
    });
    const [next] = pending.splice(best, 1);
    ordered.push(next);
    here = next;
  }
  return [...ordered, ...pincodeOrder(stops.filter((s) => !located(s)))];
}

function mostCommon(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** "Temple Road · 636903": the trip's most common street and pincode */
export function areaLabel(stops: PlanStop[]): string {
  // The first address part with letters is usually the street ("12, Temple Road, Harur" → "Temple Road")
  const streets = stops.map((s) => s.address?.split(",").map((p) => p.trim()).find((p) => /[a-z]/i.test(p))).filter((p): p is string => !!p);
  const parts = [mostCommon(streets), mostCommon(stops.map((s) => s.pincode).filter((p): p is string => !!p))].filter(Boolean);
  return parts.join(" · ") || "Mixed area";
}

interface PlanOptions { maxPerTrip: number; maxTrips: number }

/** Groups a wave's orders into balanced trips by locality, within the fleet's capacity */
export function planTrips(stops: PlanStop[], origin: LatLng, { maxPerTrip, maxTrips }: PlanOptions): PlanResult {
  if (stops.length === 0 || maxTrips <= 0 || maxPerTrip <= 0) return { groups: [], overflow: stops };
  const sequence = [...sweepOrder(stops.filter(located), origin), ...pincodeOrder(stops.filter((s) => !located(s)))];
  const fits = sequence.slice(0, maxTrips * maxPerTrip);
  const trips = Math.min(maxTrips, Math.ceil(fits.length / maxPerTrip));
  const groups = balancedChunks(fits, trips).map((chunk) => ({ stops: routeOrder(chunk, origin), areaLabel: areaLabel(chunk) }));
  return { groups, overflow: sequence.slice(fits.length) };
}

/** Suggests a rider per trip: the roster rider with the fewest trips so far, never above their limit */
export function suggestRiders(tripCount: number, roster: string[], load: Map<string, number>, maxTripsPerRider: number): (string | null)[] {
  const taken = new Map(roster.map((id) => [id, load.get(id) ?? 0]));
  return Array.from({ length: tripCount }, () => {
    const pick = [...taken.entries()].filter(([, n]) => n < maxTripsPerRider).sort((a, b) => a[1] - b[1])[0];
    if (!pick) return null;
    taken.set(pick[0], pick[1] + 1);
    return pick[0];
  });
}
