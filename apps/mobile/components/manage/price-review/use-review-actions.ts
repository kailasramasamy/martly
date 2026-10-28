import { useCallback } from "react";
import type { PriceReviewBulkInput, PriceReviewDecision } from "@martly/shared/schemas";
import type { PriceReviewResult } from "@martly/shared/types";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";

type Bulk = Omit<PriceReviewBulkInput, "storeId">;

/** Settle listings (one, many, or a whole brand/aisle) and offer Undo, which puts them back in the queue */
export function useReviewActions(storeId: string | null, onChange: () => void) {
  const toast = useToast();
  const { run, running } = useAction();

  const undoable = useCallback((message: string, batch: string) => {
    toast.show(message, "success", [{
      label: "Undo",
      onPress: async () => {
        const ok = await run(() => api.post("/api/v1/price-review/reopen", { storeId, batch }));
        if (ok) onChange();
      },
    }]);
  }, [toast, run, storeId, onChange]);

  const decide = useCallback(async (items: PriceReviewDecision[]) => {
    if (!storeId) return undefined;
    const res = await run(() => api.post<PriceReviewResult>("/api/v1/price-review/decide", { storeId, items }));
    return res?.data;
  }, [run, storeId]);

  const bulk = useCallback(async (body: Bulk, message: (n: number) => string) => {
    if (!storeId) return;
    const res = await run(() => api.post<PriceReviewResult>("/api/v1/price-review/bulk", { storeId, ...body }));
    if (!res) return;
    onChange();
    // A new price can't be undone by reopening, so only keep and hide offer Undo
    if (body.action === "percentOffMrp") toast.show(message(res.data.updated), "success");
    else undoable(message(res.data.updated), res.data.batch);
  }, [run, storeId, onChange, toast, undoable]);

  return { decide, bulk, undoable, running };
}
