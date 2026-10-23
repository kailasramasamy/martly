import { useState } from "react";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useResource } from "../../../../lib/manage/use-resource";
import { cleanSlotLimits, type PricingData } from "./types";

const PATH = "/api/v1/marketing-admin/pricing";

/** Loads pricing and saves a full replacement; the server swaps the whole product list, so callers pass everything */
export function usePricing() {
  const { data, setData, loading, error, reload } = useResource<PricingData>(PATH);
  const { run, running } = useAction();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  /** Resolves true once saved, false when the server refused (the error shows as a toast) */
  const save = async (next: PricingData): Promise<boolean> => {
    const body = { products: next.products, config: { ...next.config, slotLimits: cleanSlotLimits(next.config.slotLimits) } };
    const res = await run(() => api.put<PricingData>(PATH, body), "Pricing saved");
    if (!res) return false;
    setData(res.data);
    return true;
  };

  return { data, loading, error, reload, refresh, refreshing, save, saving: running };
}
