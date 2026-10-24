import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeChrome, HomeSection, HomeSectionsPage } from "@martly/shared/types";
import { api } from "./api";
import type { StoreProduct } from "./types";

export type MobileHomeSection = HomeSection<StoreProduct>;

/** Home's merchandising sections for a store, a page at a time; the first page also carries the page chrome */
export function useHomeSections(storeId: string | undefined) {
  const [sections, setSections] = useState<MobileHomeSection[]>([]);
  const [chrome, setChrome] = useState<HomeChrome | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const cursor = useRef<string | null>(null);
  const request = useRef(0);

  const fetchPage = useCallback(
    (after: string | null) => api.get<HomeSectionsPage<StoreProduct>>(
      `/api/v1/home/${storeId}/sections${after ? `?cursor=${encodeURIComponent(after)}` : ""}`,
    ),
    [storeId],
  );

  const reload = useCallback(() => {
    const id = ++request.current;
    cursor.current = null;
    setReachedEnd(false);
    if (!storeId) {
      setSections([]);
      setChrome(null);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return fetchPage(null)
      .then((res) => {
        if (id !== request.current) return;
        setSections(res.data.sections);
        setChrome(res.data.chrome ?? null);
        cursor.current = res.data.nextCursor;
        setReachedEnd(!res.data.nextCursor);
      })
      // Keeps what was on screen; pull-to-refresh retries
      .catch(() => {})
      .finally(() => { if (id === request.current) setLoading(false); });
  }, [fetchPage, storeId]);

  useEffect(() => {
    setSections([]);
    setChrome(null);
    reload();
  }, [reload]);

  const loadMore = useCallback(() => {
    const after = cursor.current;
    if (!after || loading || loadingMore) return;
    const id = request.current;
    setLoadingMore(true);
    fetchPage(after)
      .then((res) => {
        if (id !== request.current) return;
        cursor.current = res.data.nextCursor;
        setReachedEnd(!res.data.nextCursor);
        setSections((prev) => [...prev, ...res.data.sections]);
      })
      // The next scroll to the end retries the page
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [fetchPage, loading, loadingMore]);

  return { storeId, sections, chrome, loading, loadingMore, reachedEnd, reload, loadMore };
}
