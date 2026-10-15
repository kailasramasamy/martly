import { useCallback, useEffect, useRef, useState } from "react";
import { useManageScope } from "../../../lib/manage-scope-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useOrdersFilterRequest, useOrdersTick } from "../../../lib/manage/use-live-orders";
import { COUNTED_STATUSES } from "./OrderToolbar";
import { forwardStatus } from "./order-flow";
import { useOrderActions } from "./use-order-actions";
import { useOrderSelection } from "./use-order-selection";
import { useStatusCounts } from "./use-status-counts";
import type { OrderListItem } from "./types";

export function commonForwardStatus(orders: OrderListItem[]): string | undefined {
  const forwards = new Set(orders.map(forwardStatus));
  return forwards.size === 1 ? [...forwards][0] : undefined;
}

/** All state behind the Orders tab: filters, paged list, live refresh, selection and mutations */
export function useOrdersTab() {
  const { storeId, loading: scopeLoading, stores } = useManageScope();
  const [status, setStatus] = useState("ACTIVE");
  const [query, setQuery] = useState("");
  const selection = useOrderSelection();
  const filterRequest = useOrdersFilterRequest();
  const tick = useOrdersTick();
  const seenTick = useRef(tick);

  const list = usePagedList<OrderListItem>(
    "/api/v1/orders",
    { status: status === "ALL" ? undefined : status === "ACTIVE" ? COUNTED_STATUSES.join(",") : status, storeId, q: query.trim() },
    { enabled: !scopeLoading && stores.length > 0 },
  );
  const { counts, reload: reloadCounts } = useStatusCounts(COUNTED_STATUSES, storeId);
  const { refresh } = list;
  const { clear } = selection;
  const afterChange = useCallback(() => { refresh(); reloadCounts(); clear(); }, [refresh, reloadCounts, clear]);
  const actions = useOrderActions(afterChange);

  useEffect(() => {
    if (seenTick.current === tick) return;
    seenTick.current = tick;
    refresh();
  }, [tick, refresh]);
  useEffect(() => { if (filterRequest) setStatus(filterRequest.status); }, [filterRequest]);
  useEffect(() => { clear(); }, [status, query, storeId, clear]);

  return { list, counts, selection, actions, status, setStatus, query, setQuery, scopeLoading };
}
