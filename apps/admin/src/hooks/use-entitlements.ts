import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { axiosInstance } from "../providers/data-provider";
import type { Entitlements } from "../pages/marketing/types";

/** The organisation's marketing plan and usage; `enabled` is false for roles with no organisation */
export function useEntitlements(enabled = true) {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/marketing/entitlements");
      setEntitlements(res.data.data);
      setError(null);
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      setError(err.response?.data?.message ?? "Could not load your marketing plan");
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { entitlements, error, reload };
}
