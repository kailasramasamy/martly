import { useState, useEffect, useCallback } from "react";
import { api } from "../../../lib/api";
import { useOrderWebSocket } from "../../../lib/useOrderWebSocket";
import { useRefreshOnFocus } from "../../../lib/manage/use-refresh-on-focus";
import type { RiderDay } from "./types";

type LoadMode = "initial" | "refresh" | "silent";

/** The signed-in rider's trips for a day; refetches on focus and whenever an order changes */
export function useRiderDay(date: string) {
  const [day, setDay] = useState<RiderDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: LoadMode) => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError(null);
    try {
      const res = await api.get<RiderDay>(`/api/v1/delivery-trips/mine?date=${date}`);
      setDay(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your trips");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => { load("initial"); }, [load]);

  const reload = useCallback(() => load("silent"), [load]);
  useRefreshOnFocus(reload);
  useOrderWebSocket({ onOrdersChanged: useCallback(() => { reload(); }, [reload]) });

  return { day, loading, refreshing, error, refresh: useCallback(() => load("refresh"), [load]), reload };
}
