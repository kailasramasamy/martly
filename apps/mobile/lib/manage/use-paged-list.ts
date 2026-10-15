import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import { toQuery, type QueryValue } from "./query";

interface PagedListState<T, M> {
  items: T[];
  total: number;
  /** Extra fields the endpoint adds to `meta`, e.g. search facets */
  meta: M | null;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => void;
  /** Replace one item in place after a mutation, without refetching */
  updateItem: (id: string, patch: Partial<T>) => void;
}

/**
 * Paginated list over a `PaginatedResponse` endpoint. Refetches from page 1 whenever
 * `params` change; pass `enabled: false` to wait (e.g. until a store is selected).
 */
export function usePagedList<T extends { id: string }, M = Record<string, never>>(
  path: string,
  params: Record<string, QueryValue> = {},
  { pageSize = 20, enabled = true }: { pageSize?: number; enabled?: boolean } = {},
): PagedListState<T, M> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState<M | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params);
  const requestId = useRef(0);

  const fetchPage = useCallback(async (nextPage: number) => {
    const id = ++requestId.current;
    const res = await api.getList<T>(`${path}${toQuery({ ...JSON.parse(paramsKey), page: nextPage, pageSize })}`);
    if (id !== requestId.current) return;
    setItems((prev) => (nextPage === 1 ? res.data : [...prev, ...res.data]));
    setTotal(res.meta.total);
    if (nextPage === 1) setMeta(res.meta as unknown as M);
    setTotalPages(res.meta.totalPages);
    setPage(nextPage);
  }, [path, paramsKey, pageSize]);

  const run = useCallback(async (nextPage: number, mode: "initial" | "refresh" | "more") => {
    const setFlag = mode === "initial" ? setLoading : mode === "refresh" ? setRefreshing : setLoadingMore;
    setFlag(true);
    setError(null);
    try {
      await fetchPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setFlag(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    run(1, "initial");
  }, [enabled, run]);

  const refresh = useCallback(() => run(1, "refresh"), [run]);
  const loadMore = useCallback(() => {
    if (!loading && !refreshing && !loadingMore && page < totalPages) run(page + 1, "more");
  }, [loading, refreshing, loadingMore, page, totalPages, run]);
  const updateItem = useCallback((id: string, patch: Partial<T>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  return { items, total, meta, loading, refreshing, loadingMore, error, refresh, loadMore, updateItem };
}
