import { useState, useEffect, useCallback } from "react";
import { api } from "../../../lib/api";
import type { TripRoute } from "./types";

/**
 * ETAs for the remaining stops of an on-the-road trip. Refetches when `signature` changes (a stop finished);
 * `reload` is for when the rider has moved. Null when the trip isn't running or no stop has coordinates.
 */
export function useTripRoute(tripId: string | null, signature: string) {
  const [route, setRoute] = useState<TripRoute | null>(null);

  const reload = useCallback(() => {
    if (!tripId) return;
    // ETAs are a nicety: without them the stops simply show no time
    api.get<TripRoute | null>(`/api/v1/rider-location/trips/${tripId}/route`).then((res) => setRoute(res.data), () => setRoute(null));
  }, [tripId]);

  useEffect(() => {
    if (!tripId) setRoute(null);
    else reload();
  }, [tripId, signature, reload]);

  return { route, reload };
}
