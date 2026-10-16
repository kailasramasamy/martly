import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "../../../../lib/api";
import type { DeliveryPlan } from "./types";
import { useRefreshOnFocus } from "../../../../lib/manage/use-refresh-on-focus";

type LoadMode = "initial" | "refresh" | "silent";

// While a trip is on the road, the board follows the rider without a pull
const LIVE_REFRESH_MS = 30_000;

/** The day's waves for a store; `setPlan` swaps in the plan a mutation already returned */
export function useDeliveryPlan(storeId: string | null, date: string) {
  const [plan, setPlan] = useState<DeliveryPlan | null>(null);
  const [loading, setLoading] = useState(!!storeId);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: LoadMode) => {
    if (!storeId) return;
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError(null);
    try {
      const res = await api.get<DeliveryPlan>(`/api/v1/delivery-plan?storeId=${storeId}&date=${date}`);
      setPlan(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the delivery plan");
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

  // Back from an order, a slot or the roster: show what changed there
  useRefreshOnFocus(useCallback(() => load("silent"), [load]));

  const onRoad = !!plan?.waves.some((w) => w.trips.some((t) => t.status === "IN_PROGRESS"));
  useFocusEffect(useCallback(() => {
    if (!onRoad) return undefined;
    const timer = setInterval(() => load("silent"), LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [onRoad, load]));

  return {
    plan, setPlan, loading, refreshing, error,
    refresh: useCallback(() => load("refresh"), [load]),
    reloadQuietly: useCallback(() => load("silent"), [load]),
  };
}
