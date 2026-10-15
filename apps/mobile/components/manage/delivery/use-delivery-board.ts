import { useState, useEffect, useCallback } from "react";
import { api } from "../../../lib/api";
import type { BoardData, Trip } from "./types";

type LoadMode = "initial" | "refresh" | "silent";

export function useDeliveryBoard(storeId: string | null, date: string) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(!!storeId);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: LoadMode) => {
    if (!storeId) return;
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError(null);
    try {
      const query = `storeId=${storeId}&date=${date}`;
      const [boardRes, tripsRes] = await Promise.all([
        api.get<BoardData>(`/api/v1/orders/delivery-board?${query}`),
        api.get<Trip[]>(`/api/v1/delivery-trips?${query}`),
      ]);
      setBoard(boardRes.data);
      setTrips(tripsRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the delivery board");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId, date]);

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    load("initial");
  }, [load, storeId]);

  return {
    board,
    trips,
    loading,
    refreshing,
    error,
    refresh: useCallback(() => load("refresh"), [load]),
    reloadQuietly: useCallback(() => load("silent"), [load]),
  };
}
