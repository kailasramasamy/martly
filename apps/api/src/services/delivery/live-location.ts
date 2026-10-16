import type { DirectionsResult } from "../../lib/geo.js";

/** Where a rider last was on a trip; kept in memory, since it only matters while the trip is on the road */
export interface RiderLocation {
  riderId: string;
  tripId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updatedAt: string;
}

interface RouteCacheEntry {
  result: DirectionsResult;
  originLat: number;
  originLng: number;
  stopCount: number;
  cachedAt: number;
}

const locations = new Map<string, RiderLocation>();
const routes = new Map<string, RouteCacheEntry>();
const LOCATION_TTL_MS = 10 * 60_000;
const ROUTE_TTL_MS = 120_000;

// Drop what's gone stale: a rider who stopped sending, a route nobody asked for again
setInterval(() => {
  const now = Date.now();
  for (const [tripId, loc] of locations) if (now - new Date(loc.updatedAt).getTime() > LOCATION_TTL_MS) locations.delete(tripId);
  for (const [tripId, entry] of routes) if (now - entry.cachedAt > ROUTE_TTL_MS) routes.delete(tripId);
}, 60_000).unref();

export function setRiderLocation(location: RiderLocation) {
  locations.set(location.tripId, location);
}

export function riderLocation(tripId: string): RiderLocation | undefined {
  return locations.get(tripId);
}

export function cachedRoute(tripId: string) {
  return routes.get(tripId);
}

export function cacheRoute(tripId: string, entry: RouteCacheEntry) {
  routes.set(tripId, entry);
}

/** A stop finished or failed: the next route request must be fresh */
export function invalidateRoute(tripId: string) {
  routes.delete(tripId);
}

/** The trip is over: forget where its rider was and how they were routed */
export function forgetTrip(tripId: string) {
  locations.delete(tripId);
  routes.delete(tripId);
}
