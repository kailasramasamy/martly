import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { FestiveHero, StoreProduct } from "./types";

const PAGE_SIZE = 20;

export function useFestiveHero(collectionId: string, storeId: string | undefined) {
  const [hero, setHero] = useState<FestiveHero | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get<FestiveHero>(`/api/v1/festive/${collectionId}?storeId=${storeId}`)
      .then((res) => setHero(res.data))
      // A 404 means the festival ended or this store can't stock it; the screen shows its empty state
      .catch(() => setHero(null))
      .finally(() => setLoading(false));
  }, [collectionId, storeId]);

  return { hero, loading };
}

// One tile's shelf a page at a time; switching tiles drops responses for the tile the user left
export function useTileProducts(collectionId: string, tileId: string | null, storeId: string | undefined) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const page = useRef(1);
  const totalPages = useRef(1);
  const request = useRef(0);

  const path = useCallback(
    (p: number) => `/api/v1/festive/${collectionId}/tiles/${tileId}/products?storeId=${storeId}&page=${p}&pageSize=${PAGE_SIZE}`,
    [collectionId, tileId, storeId],
  );

  useEffect(() => {
    if (!storeId || !tileId) return;
    const id = ++request.current;
    setLoading(true);
    setFailed(false);
    setProducts([]);
    page.current = 1;
    api.getList<StoreProduct>(path(1))
      .then((res) => {
        if (id !== request.current) return;
        setProducts(res.data);
        totalPages.current = res.meta.totalPages;
      })
      .catch(() => { if (id === request.current) setFailed(true); })
      .finally(() => { if (id === request.current) setLoading(false); });
  }, [path, storeId, tileId]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || page.current >= totalPages.current) return;
    const id = request.current;
    setLoadingMore(true);
    api.getList<StoreProduct>(path(page.current + 1))
      .then((res) => {
        if (id !== request.current) return;
        page.current += 1;
        setProducts((prev) => [...prev, ...res.data]);
      })
      // The next scroll to the end retries the page
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loading, loadingMore, path]);

  return { products, loading, loadingMore, failed, loadMore };
}
