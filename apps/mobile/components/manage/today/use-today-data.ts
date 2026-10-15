import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { toQuery } from "../../../lib/manage/query";
import { useOrdersTick } from "../../../lib/manage/use-live-orders";
import type { DashboardStats, LowStockItem, StockSummary } from "./types";

/** Dashboard stats + stock summary for a store scope; reloads on live order changes */
export function useTodayData(storeId: string | null, enabled: boolean) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [stock, setStock] = useState<StockSummary | null>(null);
  const [lowItems, setLowItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tick = useOrdersTick();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [statsRes, stockRes, lowRes] = await Promise.all([
        api.get<DashboardStats>(`/api/v1/dashboard/stats${toQuery({ days: 7, storeId })}`),
        api.get<StockSummary>(`/api/v1/stock/summary${toQuery({ storeId })}`),
        api.getList<LowStockItem>(`/api/v1/store-products${toQuery({ stockStatus: "low_stock", pageSize: 4, storeId })}`),
      ]);
      setStats(statsRes.data);
      setStock(stockRes.data);
      setLowItems(lowRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load today's numbers");
    }
  }, [storeId]);

  useEffect(() => {
    if (!enabled) return;
    load().finally(() => setLoading(false));
  }, [enabled, load, tick]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { stats, stock, lowItems, loading, refreshing, error, refresh };
}
