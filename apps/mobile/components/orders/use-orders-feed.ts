import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { useOrderWebSocket } from "../../lib/useOrderWebSocket";
import { ACTIVE_STATUSES, type OrderFilter, type OrderSummary } from "./types";

const PAGE_SIZE = 20;
const ACTIVE_LIMIT = 50;
const POLL_MS = 60_000;

const HISTORY_STATUS: Record<Exclude<OrderFilter, "ACTIVE">, string> = {
  ALL: "DELIVERED,CANCELLED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

/**
 * Active orders (always fetched, for the chip count) plus paginated past orders for the filter.
 * Live refreshes reload every page already shown, so scrolling position and loaded history survive.
 */
export function useOrdersFeed(filter: OrderFilter) {
  const [active, setActive] = useState<OrderSummary[]>([]);
  const [history, setHistory] = useState<OrderSummary[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loaded = useRef(PAGE_SIZE);
  // Only the latest reload, and only pages of the filter still shown, may land: a slower answer is dropped
  const latestReload = useRef(0);
  const historyStatus = filter === "ACTIVE" ? null : HISTORY_STATUS[filter];
  const statusShown = useRef(historyStatus);
  statusShown.current = historyStatus;

  const historyPath = useCallback(
    (page: number, pageSize: number) => `/api/v1/orders?status=${historyStatus}&page=${page}&pageSize=${pageSize}`,
    [historyStatus],
  );

  const reload = useCallback(async () => {
    const call = ++latestReload.current;
    try {
      const [a, h] = await Promise.all([
        api.getList<OrderSummary>(`/api/v1/orders?status=${ACTIVE_STATUSES.join(",")}&pageSize=${ACTIVE_LIMIT}`),
        historyStatus ? api.getList<OrderSummary>(historyPath(1, loaded.current)) : null,
      ]);
      if (call !== latestReload.current) return;
      setActive(a.data);
      setHistory(h?.data ?? []);
      setHistoryTotal(h?.meta.total ?? 0);
      setPhase("ready");
    } catch {
      // A failed background refresh keeps what's on screen; only a first load shows the error state
      if (call === latestReload.current) setPhase((p) => (p === "ready" ? p : "error"));
    } finally {
      if (call === latestReload.current) setRefreshing(false);
    }
  }, [historyStatus, historyPath]);

  useEffect(() => {
    loaded.current = PAGE_SIZE;
    setPhase("loading");
    reload();
  }, [reload]);

  useOrderWebSocket({ onOrdersChanged: reload });

  useEffect(() => {
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!historyStatus || loadingMore || phase !== "ready" || history.length >= historyTotal) return;
    setLoadingMore(true);
    try {
      const res = await api.getList<OrderSummary>(historyPath(Math.floor(history.length / PAGE_SIZE) + 1, PAGE_SIZE));
      if (statusShown.current !== historyStatus) return;
      setHistory((prev) => {
        const seen = new Set(prev.map((o) => o.id));
        const next = [...prev, ...res.data.filter((o) => !seen.has(o.id))];
        loaded.current = Math.max(PAGE_SIZE, Math.ceil(next.length / PAGE_SIZE) * PAGE_SIZE);
        return next;
      });
      setHistoryTotal(res.meta.total);
    } catch {
      // Nothing is lost: reaching the end of the list again retries the page
    } finally {
      setLoadingMore(false);
    }
  }, [historyStatus, loadingMore, phase, history.length, historyTotal, historyPath]);

  const retry = useCallback(() => {
    setPhase("loading");
    reload();
  }, [reload]);

  return { active, history, phase, refreshing, loadingMore, hasMore: history.length < historyTotal, refresh, loadMore, retry, reload };
}
