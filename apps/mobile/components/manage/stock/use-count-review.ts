import { useState } from "react";
import type { useCountDetail } from "./use-count-detail";
import { useRecountSelection } from "./use-recount-selection";
import type { StockCountDetail, StockCountItem } from "./types";

/** Only lines that were counted and not yet applied to stock can go back for a recount */
export const selectable = (item: StockCountItem) => item.countedQty !== null && !item.applied;

/** Approver-side state on a submitted count: choosing lines to recount, the recount sheet and the open line */
export function useCountReview(c: ReturnType<typeof useCountDetail>, count: StockCountDetail) {
  const sel = useRecountSelection();
  const [recountOpen, setRecountOpen] = useState(false);
  const [lineId, setLineId] = useState<string | null>(null);
  const line = count.items.find((i) => i.storeProductId === lineId) ?? null;
  const restCount = count.items.filter((i) => selectable(i) && !sel.selected?.has(i.storeProductId)).length;

  const onRowPress = (item: StockCountItem) => {
    if (!sel.selected) return setLineId(item.storeProductId);
    if (selectable(item)) sel.toggle(item.storeProductId);
  };

  const send = async (note: string, approveRest: boolean) => {
    if (!sel.selected || !(await c.requestRecount([...sel.selected], note, approveRest))) return;
    setRecountOpen(false);
    sel.cancel();
  };

  const correct = async (storeProductId: string, qty: number, reason: string) => {
    const ok = await c.correct(storeProductId, qty, reason);
    if (ok) setLineId(null);
    return ok;
  };

  return {
    selected: sel.selected, startSelecting: sel.start, cancelSelecting: sel.cancel,
    recountOpen, openRecount: () => setRecountOpen(true), closeRecount: () => setRecountOpen(false),
    line, closeLine: () => setLineId(null), restCount, onRowPress, send, correct,
  };
}
