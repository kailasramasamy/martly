import { useCallback, useState } from "react";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { useToast } from "../../../lib/toast-context";
import { refreshCountsWaiting } from "../../../lib/manage/use-counts-waiting";
import type { StockCountDetail } from "./types";

/** Loads one count and owns its draft edits (blind quantities) plus every mutation on it */
export function useCountDetail(id: string) {
  const base = `/api/v1/stock/counts/${id}`;
  const { data, setData, loading, error, reload } = useResource<StockCountDetail>(base);
  const toast = useToast();
  const { run, running } = useAction();
  // Quantities typed this session, keyed by storeProductId
  const [edits, setEdits] = useState<Record<string, string>>({});

  const setQty = useCallback((storeProductId: string, value: string) => {
    setEdits((prev) => ({ ...prev, [storeProductId]: value }));
  }, []);

  const valueFor = (storeProductId: string, counted: number | null) =>
    edits[storeProductId] ?? (counted === null ? "" : String(counted));

  const touched = Object.entries(edits).filter(([, v]) => v !== "");
  const dirty = touched.length > 0;

  const persist = async (): Promise<StockCountDetail | undefined> => {
    if (!dirty) return data ?? undefined;
    const lines = touched.map(([storeProductId, v]) => ({ storeProductId, countedQty: Number(v) }));
    const res = await api.put<StockCountDetail>(`${base}/lines`, { lines });
    setData(res.data);
    setEdits({});
    return res.data;
  };

  const save = () => run(persist, "Count saved");

  // The count changed hands (submitted, sent back, approved), so the waiting-count badge may change too
  const handOver = (detail: StockCountDetail) => {
    setData(detail);
    refreshCountsWaiting();
  };

  const submit = async () => {
    const done = await run(async () => {
      await persist();
      return (await api.post<StockCountDetail>(`${base}/submit`, {})).data;
    });
    if (done) {
      handOver(done);
      toast.show(done.status === "APPROVED" ? "Count submitted and applied" : "Count submitted for review", "success");
    }
    return done;
  };

  const review = async (action: "approve" | "reject", note: string) => {
    const done = await run(
      () => api.post<StockCountDetail>(`${base}/${action}`, note.trim() ? { note: note.trim() } : {}),
      action === "approve" ? "Count approved" : "Count rejected",
    );
    if (done) handOver(done.data);
    return !!done;
  };

  const requestRecount = async (storeProductIds: string[], note: string, approveRest: boolean) => {
    const body = { storeProductIds, approveRest, ...(note.trim() ? { note: note.trim() } : {}) };
    const done = await run(
      () => api.post<StockCountDetail>(`${base}/recount`, body),
      approveRest ? "Sent for recount, rest approved" : "Sent for recount",
    );
    if (done) handOver(done.data);
    return !!done;
  };

  const correct = async (storeProductId: string, countedQty: number, reason: string) => {
    const done = await run(
      () => api.put<StockCountDetail>(`${base}/lines/${storeProductId}/correct`, { countedQty, reason }),
      "Count corrected",
    );
    if (done) setData(done.data);
    return !!done;
  };

  const discard = async () => !!(await run(() => api.delete(base), "Count discarded"));

  return { data, loading, error, reload, running, dirty, setQty, valueFor, save, submit, review, requestRecount, correct, discard };
}
