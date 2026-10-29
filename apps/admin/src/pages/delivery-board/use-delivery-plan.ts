import { useCallback, useEffect, useRef, useState } from "react";
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
  // Only the latest load lands: a slow answer for the store or day switched away from is dropped
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    const call = ++latestLoad.current;
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/delivery-plan?storeId=${storeId}&date=${date}`);
      if (call === latestLoad.current) setPlan(res.data.data);
    } catch (err: any) {
      if (call === latestLoad.current) message.error(err?.response?.data?.message ?? "Failed to load delivery plan");
    } finally {
      if (call === latestLoad.current) setLoading(false);
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
