import { useCallback, useState } from "react";
import type { PriceReviewDecision } from "@martly/shared/schemas";
import type { PriceReviewItem } from "@martly/shared/types";
import { useToast } from "../../../lib/toast-context";
import type { Settled } from "./ProgressHero";

export interface Draft {
  price: string;
  mrp: string;
}

interface Queue {
  items: PriceReviewItem[];
  updateItem: (id: string, patch: Partial<PriceReviewItem>) => void;
  /** Fetch the next batch once everything loaded is settled */
  reload: () => void;
  loadMore: () => void;
  hasMore: boolean;
}

const toDraft = (item: PriceReviewItem): Draft => ({ price: String(item.price), mrp: item.mrp === null ? "" : String(item.mrp) });
const money = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[^\d.]/g, "")));

/** The decision for a row as edited: only fields that moved are sent; an MRP back at the catalog's clears the store's own */
export function decisionFor(item: PriceReviewItem, draft: Draft, hide = false): { decision: PriceReviewDecision; error?: string; outcome: Settled } {
  const price = money(draft.price);
  const mrp = money(draft.mrp);
  const decision: PriceReviewDecision = { id: item.id, ...(hide ? { hide } : {}) };
  if (price !== null && price !== item.price) decision.price = price;
  if (mrp !== item.mrp) decision.mrp = mrp === item.masterMrp ? null : mrp;
  const changed = decision.price !== undefined || decision.mrp !== undefined;
  if (hide) return { decision: { id: item.id, hide }, outcome: "notCarried" };
  const outcome = changed ? "CHANGED" : "KEPT";
  if (!price || price <= 0) return { decision, outcome, error: "Enter a price" };
  if (mrp !== null && price > mrp) return { decision, outcome, error: `Price can't be more than the MRP ₹${mrp}` };
  return { decision, outcome };
}

/** One row open at a time: keep a price with ✓, or open a row to edit it; saving closes it */
export function useReviewQueue(queue: Queue, decide: (items: PriceReviewDecision[]) => Promise<{ batch: string } | undefined>) {
  const toast = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ price: "", mrp: "" });
  /** Rows settled on this screen: they stay in place (paging stays stable) with their outcome and an undo */
  const [settled, setSettled] = useState<Map<string, { outcome: Settled; batch: string }>>(new Map());

  const open = useCallback((item: PriceReviewItem | null) => {
    setActiveId(item?.id ?? null);
    if (item) setDraft(toDraft(item));
  }, []);

  // Once everything loaded is settled, the server's next page of waiting rows starts afresh
  const nextBatchIfDone = useCallback((done: Set<string>) => {
    if (queue.hasMore && queue.items.every((i) => done.has(i.id))) {
      setSettled(new Map());
      queue.reload();
    }
  }, [queue]);

  const settle = useCallback(async (item: PriceReviewItem, edit: Draft, hide = false) => {
    const { decision, outcome, error } = decisionFor(item, edit, hide);
    if (error) return toast.show(error, "error");
    const res = await decide([decision]);
    if (!res) return;
    queue.updateItem(item.id, outcome === "notCarried"
      ? { carried: false }
      : { price: decision.price ?? item.price, mrp: decision.mrp === undefined ? item.mrp : decision.mrp ?? item.masterMrp, outcome });
    const next = new Map(settled).set(item.id, { outcome, batch: res.batch });
    setSettled(next);
    // The row closes (and the keypad with it) so the rest of the list stays in view; the next one is the manager's pick
    if (activeId === item.id) setActiveId(null);
    nextBatchIfDone(new Set(next.keys()));
  }, [decide, queue, settled, activeId, nextBatchIfDone, toast]);

  const forget = useCallback((id: string) => setSettled((prev) => {
    const next = new Map(prev);
    next.delete(id);
    return next;
  }), []);

  const reset = useCallback(() => {
    setActiveId(null);
    setSettled(new Map());
  }, []);

  return { activeId, draft, setDraft, open, settled, settle, forget, reset };
}
