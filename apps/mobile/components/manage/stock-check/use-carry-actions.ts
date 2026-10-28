import { useCallback } from "react";
import type { StockCheckEditInput, StockCheckScope } from "@martly/shared/schemas";
import type { StockCheckEditResult, StockCheckResult } from "@martly/shared/types";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";

/**
 * Mark a department, brand or set of sizes carried or not, each with an Undo that puts it back as it was.
 * `onUndone` runs after an undo (from the toast or a card), when a screen tracks its own decided rows.
 */
export function useCarryActions(storeId: string | null, onChange: () => void, onUndone: (batch: string) => void = onChange) {
  const toast = useToast();
  const { run, running } = useAction();

  const undo = useCallback(async (batch: string) => {
    const ok = await run(() => api.post("/api/v1/stock-check/undo", { storeId, batch }));
    if (ok) onUndone(batch);
  }, [run, storeId, onUndone]);

  const done = useCallback((message: string, result: StockCheckResult) => {
    onChange();
    toast.show(message, "success", [{ label: "Undo", onPress: () => { void undo(result.batch); } }]);
    return result;
  }, [onChange, toast, undo]);

  const decide = useCallback(async (scope: StockCheckScope, carried: boolean, message: (n: number) => string) => {
    if (!storeId) return undefined;
    const res = await run(() => api.post<StockCheckResult>("/api/v1/stock-check/decide", { storeId, scope, carried }));
    return res ? done(message(res.data.updated), res.data) : undefined;
  }, [run, storeId, done]);

  const saveSizes = useCallback(async (items: { id: string; carried: boolean }[], message: string) => {
    if (!storeId) return undefined;
    const res = await run(() => api.post<StockCheckResult>("/api/v1/stock-check/sizes", { storeId, items }));
    return res ? done(message, res.data) : undefined;
  }, [run, storeId, done]);

  // A new price can't be taken back by undo, so an edit just confirms
  const editProduct = useCallback(async (productId: string, edit: Pick<StockCheckEditInput, "sizes" | "newSizes">) => {
    if (!storeId) return undefined;
    const res = await run(() => api.post<StockCheckEditResult>("/api/v1/stock-check/edit", { storeId, productId, ...edit }), "Saved");
    return res?.data;
  }, [run, storeId]);

  return { decide, saveSizes, editProduct, undo, running };
}
