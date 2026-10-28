import { useState } from "react";
import type { PriceReviewItem } from "@martly/shared/types";
import type { PriceReviewDecision } from "@martly/shared/schemas";

/** `mrp: null` goes back to the catalog's MRP */
export interface RowEdit {
  price?: number;
  mrp?: number | null;
}

export const effectivePrice = (i: PriceReviewItem, e?: RowEdit) => e?.price ?? i.price;
export const effectiveMrp = (i: PriceReviewItem, e?: RowEdit) => (e?.mrp === undefined ? i.mrp : (e.mrp ?? i.masterMrp));

export const isDirty = (i: PriceReviewItem, e?: RowEdit) =>
  !!e && (effectivePrice(i, e) !== i.price || effectiveMrp(i, e) !== i.mrp);

export const offPct = (price: number, mrp: number | null) => (mrp ? Math.round((1 - price / mrp) * 100) : null);

/** An untouched row keeps its price; only what changed is sent */
export function toDecision(i: PriceReviewItem, e?: RowEdit): PriceReviewDecision {
  const decision: PriceReviewDecision = { id: i.id };
  if (e && effectivePrice(i, e) !== i.price) decision.price = effectivePrice(i, e);
  if (e && effectiveMrp(i, e) !== i.mrp) decision.mrp = e.mrp;
  return decision;
}

export function useRowEdits() {
  const [edits, setEdits] = useState<Map<string, RowEdit>>(new Map());

  const patch = (id: string, change: RowEdit) =>
    setEdits((prev) => new Map(prev).set(id, { ...prev.get(id), ...change }));
  const revert = (id: string) =>
    setEdits((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  const clear = () => setEdits(new Map());

  return { edits, patch, revert, clear };
}
