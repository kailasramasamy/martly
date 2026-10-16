import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { useManageScope } from "../../../../lib/manage-scope-context";
import { useOrderWebSocket } from "../../../../lib/useOrderWebSocket";
import { toDateKey } from "../../ui/dates";
import { defaultWaveKey, waveKey } from "./format";
import { useDeliveryPlan } from "./use-delivery-plan";
import { usePlanSheets } from "./use-plan-sheets";

/** State behind the dispatcher's Delivery tab: day, picked wave, plan data, sheets and live refresh */
export function usePlanDesk() {
  const router = useRouter();
  const { storeId, loading: scopeLoading } = useManageScope();
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [picked, setPicked] = useState<string | null>(null);
  const data = useDeliveryPlan(storeId, date);
  const sheets = usePlanSheets();
  const { plan, reloadQuietly } = data;

  useOrderWebSocket({ onOrdersChanged: useCallback(() => { reloadQuietly(); }, [reloadQuietly]), enabled: !!storeId });

  const waves = plan?.waves ?? [];
  const key = waves.some((w) => waveKey(w) === picked) ? picked : plan ? defaultWaveKey(waves, plan.isToday) : null;

  return {
    storeId, scopeLoading, date, data, sheets,
    wave: waves.find((w) => waveKey(w) === key) ?? null,
    waveKey: key,
    pickWave: setPicked,
    changeDate: (next: string) => { setPicked(null); setDate(next); },
    openRiders: () => router.push(`/manage/riders${storeId ? `?storeId=${storeId}` : ""}`),
  };
}
