import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { message } from "antd";
import { axiosInstance } from "../../providers/data-provider";
import type { CountDetail } from "./count-items-table";

const errMsg = (err: any, fallback: string) => err?.response?.data?.message ?? fallback;

/** One count with its draft quantities and recount selection */
export function useCountData(id: string | undefined) {
  const [count, setCount] = useState<CountDetail | null>(null);
  const [draft, setDraft] = useState<Record<string, number | null>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const applyDetail = useCallback((detail: CountDetail) => {
    setCount(detail);
    setDraft(Object.fromEntries(detail.items.map((i) => [i.storeProductId, i.countedQty])));
    setSelectedIds([]);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/stock/counts/${id}`);
      applyDetail(res.data.data);
    } catch (err: any) {
      message.error(errMsg(err, "Failed to load count"));
    }
  }, [id, applyDetail]);

  useEffect(() => {
    load();
  }, [load]);

  return { count, draft, setDraft, selectedIds, setSelectedIds, applyDetail, load };
}

/** Save, submit, discard and review, each reloading the count when it succeeds */
export function useCountActions(id: string | undefined, draft: Record<string, number | null>, load: () => void) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success: string, fallback: string) => {
    setBusy(true);
    try {
      await action();
      message.success(success);
      return true;
    } catch (err: any) {
      message.error(errMsg(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const saveLines = () => {
    const lines = Object.entries(draft)
      .filter(([, qty]) => qty !== null && qty !== undefined)
      .map(([storeProductId, countedQty]) => ({ storeProductId, countedQty }));
    return axiosInstance.put(`/stock/counts/${id}/lines`, { lines });
  };
  const submitAll = async () => {
    await saveLines();
    await axiosInstance.post(`/stock/counts/${id}/submit`);
  };

  return {
    busy,
    save: async () => { if (await run(saveLines, "Count saved", "Failed to save count")) load(); },
    submit: async () => { if (await run(submitAll, "Count submitted", "Failed to submit count")) load(); },
    discard: async () => {
      if (await run(() => axiosInstance.delete(`/stock/counts/${id}`), "Count discarded", "Failed to discard count")) navigate("/stock-counts");
    },
    review: async (action: "approve" | "reject", note?: string) => {
      const ok = await run(() => axiosInstance.post(`/stock/counts/${id}/${action}`, { note }), action === "approve" ? "Count approved" : "Count rejected", `Failed to ${action} count`);
      if (ok) load();
      return ok;
    },
  };
}
