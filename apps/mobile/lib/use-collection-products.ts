import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { CollectionHeader, CollectionProductsResponse, StoreProduct } from "./types";

const PAGE_SIZE = 20;

export function useCollectionProducts(collectionId: string, storeId: string | undefined) {
  const [collection, setCollection] = useState<CollectionHeader | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const page = useRef(1);
  const totalPages = useRef(1);
  const request = useRef(0);

  const fetchPage = useCallback(
    (p: number) =>
      api.getList<StoreProduct>(
        `/api/v1/collections/${collectionId}/products?storeId=${storeId}&page=${p}&pageSize=${PAGE_SIZE}`,
      ) as Promise<CollectionProductsResponse>,
    [collectionId, storeId],
  );

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    const id = ++request.current;
    setLoading(true);
    setFailed(false);
    setProducts([]);
    page.current = 1;
    fetchPage(1)
      .then((res) => {
        if (id !== request.current) return;
        setCollection(res.collection);
        setProducts(res.data);
        totalPages.current = res.meta.totalPages;
      })
      .catch(() => { if (id === request.current) setFailed(true); })
      .finally(() => { if (id === request.current) setLoading(false); });
  }, [fetchPage, storeId]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || page.current >= totalPages.current) return;
    const id = request.current;
    setLoadingMore(true);
    fetchPage(page.current + 1)
      .then((res) => {
        if (id !== request.current) return;
        page.current += 1;
        setProducts((prev) => [...prev, ...res.data]);
      })
      // The next scroll to the end retries the page
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loading, loadingMore, fetchPage]);

  return { collection, products, loading, loadingMore, failed, loadMore };
}
