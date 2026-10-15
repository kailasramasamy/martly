import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { toQuery } from "../../../lib/manage/query";
import type { AnomalyRow, AnomalyType } from "./intelTypes";

export const ANOMALY_LIMIT = 100;

/** Anomaly lists can run to tens of thousands of rows (dead stock), so the API filters by type and caps the rows */
export function useAnomalies(storeId: string, days: string, type: "all" | AnomalyType) {
  const [rows, setRows] = useState<AnomalyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = toQuery({ storeId, days, type: type === "all" ? undefined : type, limit: ANOMALY_LIMIT });
      const res = await api.getList<AnomalyRow>(`/api/v1/store-intelligence/anomalies${query}`);
      setRows(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load anomalies");
    } finally {
      setLoading(false);
    }
  }, [storeId, days, type]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, total, loading, error, reload };
}
