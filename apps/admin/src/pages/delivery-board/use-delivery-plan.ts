import { useCallback, useEffect, useState } from "react";
import { message } from "antd";
import { axiosInstance } from "../../providers/data-provider";
import { useOrderWebSocket } from "../../hooks/useOrderWebSocket";
import { defaultWaveKey, waveKey } from "./types";
import type { DeliveryPlan } from "./types";

/** Loads the store's plan for a day, keeps it fresh on order changes, and tracks the selected wave */
export function useDeliveryPlan(storeId: string | null, date: string) {
  const [plan, setPlan] = useState<DeliveryPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/delivery-plan?storeId=${storeId}&date=${date}`);
      setPlan(res.data.data);
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to load delivery plan");
    } finally {
      setLoading(false);
    }
  }, [storeId, date]);

  useEffect(() => {
    setActiveKey(null);
    load();
  }, [load]);

  useOrderWebSocket({ onOrdersChanged: load });

  useEffect(() => {
    if (!plan) return;
    if (!activeKey || !plan.waves.some((w) => waveKey(w) === activeKey)) setActiveKey(defaultWaveKey(plan));
  }, [plan, activeKey]);

  const wave = plan?.waves.find((w) => waveKey(w) === activeKey) ?? null;
  return { plan, setPlan, loading, load, activeKey, setActiveKey, wave };
}
