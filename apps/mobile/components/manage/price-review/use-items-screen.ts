import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlatList } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { forbiddenStoreProductFields } from "@martly/shared/permissions";
import type { PriceReviewCounts, PriceReviewItem } from "@martly/shared/types";
import type { PriceReviewOutcome } from "@martly/shared/constants";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useReviewActions } from "./use-review-actions";
import { useReviewQueue } from "./use-review-queue";

export type Tab = "pending" | "notCarried" | PriceReviewOutcome;

type Params = { storeId: string; title?: string; brandId?: string; subcategoryId?: string; departmentId?: string; status?: string; outcome?: PriceReviewOutcome };

/** State behind the review queue screen: the list for the picked tab, the open row, undo and the "rest are OK" action */
export function useItemsScreen() {
  const p = useLocalSearchParams<Params>();
  const { user } = useAuth();
  const canHide = !!user && forbiddenStoreProductFields(user, { isActive: false }).length === 0;
  const [tab, setTab] = useState<Tab>(p.status === "notCarried" ? "notCarried" : p.status === "reviewed" && p.outcome ? p.outcome : "pending");
  const [q, setQueryText] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const scope = p.brandId ? { brandId: p.brandId } : p.subcategoryId ? { subcategoryId: p.subcategoryId } : null;
  const params = useMemo(() => ({
    storeId: p.storeId, brandId: p.brandId, subcategoryId: p.subcategoryId, departmentId: p.departmentId, q,
    ...(tab === "pending" || tab === "notCarried" ? { status: tab } : { status: "reviewed", outcome: tab }),
  }), [p.storeId, p.brandId, p.subcategoryId, p.departmentId, q, tab]);
  const list = usePagedList<PriceReviewItem, { counts: PriceReviewCounts }>("/api/v1/price-review/items", params, { pageSize: 30 });
  const actions = useReviewActions(p.storeId, list.reload);
  const { run } = useAction();
  const queue = useReviewQueue({ ...list, hasMore: list.items.length < list.total }, actions.decide);
  const listRef = useRef<FlatList<PriceReviewItem>>(null);
  const active = list.items.find((i) => i.id === queue.activeId) ?? null;

  // Whichever row opens (tapped, or next after a save) scrolls up clear of the keypad bar
  const activeIndex = list.items.findIndex((i) => i.id === queue.activeId);
  useEffect(() => {
    if (activeIndex < 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: activeIndex, viewPosition: 0.1, animated: true }));
  }, [activeIndex]);

  const undo = useCallback(async (item: PriceReviewItem) => {
    const ok = await run(() => api.post("/api/v1/price-review/reopen", { storeId: p.storeId, storeProductIds: [item.id] }));
    if (!ok) return;
    queue.forget(item.id);
    list.updateItem(item.id, { outcome: null, carried: null });
  }, [run, p.storeId, queue, list]);

  // Settled rows have left the server's waiting list, so past them the next page is fetched afresh rather than offset
  const hasMore = list.items.length < list.total;
  const onEnd = tab === "pending" && queue.settled.size
    ? () => { if (hasMore) { queue.reset(); list.reload(); } }
    : list.loadMore;

  // A reload drops settled rows from the server's count already; only those still on screen come off it
  const counts = useMemo(() => {
    const base = { ...(list.meta?.counts ?? { pending: list.total, KEPT: 0, CHANGED: 0, notCarried: 0 }) };
    if (tab !== "pending") return base;
    for (const item of list.items) {
      const done = queue.settled.get(item.id);
      if (!done) continue;
      base.pending -= 1;
      base[done.outcome] += 1;
    }
    return base;
  }, [list.meta, list.total, list.items, queue.settled, tab]);
  const left = Math.max(0, counts.pending);
  const confirmRest = async () => {
    if (!scope) return;
    await actions.bulk({ action: "confirm", scope }, (n) => `${n} prices checked`);
    setBulkOpen(false);
  };

  return {
    p, canHide, tab, setTab, q, setQueryText, bulkOpen, setBulkOpen, scope, list, actions, queue, listRef, active,
    undo, onEnd, left, counts, confirmRest,
  };
}
