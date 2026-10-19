import { useCallback, useEffect, useRef, useState } from "react";
import { HOME_DEALS_PAGE_SIZE } from "@martly/shared/constants";
import type { PriceBandChip, PriceBandDealsPage } from "@martly/shared/types";
import { api } from "./api";
import type { StoreProduct } from "./types";

type DealsSection = PriceBandDealsPage["section"];

/** A price-band deals section's products for one band and category chip, a page at a time */
export function useDealsFeed(storeId: string | undefined, sectionId: string, band: number, categoryId: string | null) {
  const [section, setSection] = useState<DealsSection | null>(null);
  const [chips, setChips] = useState<PriceBandChip[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const page = useRef(1);
  const request = useRef(0);

  const fetchPage = useCallback(
    (p: number) => api.get<PriceBandDealsPage<StoreProduct>>(
      `/api/v1/home/${storeId}/deals?sectionId=${sectionId}&band=${band}&page=${p}`
        + (categoryId ? `&categoryId=${categoryId}` : ""),
    ),
    [storeId, sectionId, band, categoryId],
  );

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    const id = ++request.current;
    setLoading(true);
    setFailed(false);
    page.current = 1;
    fetchPage(1)
      .then(({ data }) => {
        if (id !== request.current) return;
        setSection(data.section);
        setChips(data.chips);
        setProducts(data.products);
        setTotal(data.total);
      })
      .catch(() => { if (id === request.current) setFailed(true); })
      .finally(() => { if (id === request.current) setLoading(false); });
  }, [fetchPage, storeId]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || page.current * HOME_DEALS_PAGE_SIZE >= total) return;
    const id = request.current;
    setLoadingMore(true);
    fetchPage(page.current + 1)
      .then(({ data }) => {
        if (id !== request.current) return;
        page.current += 1;
        setProducts((prev) => [...prev, ...data.products]);
      })
      // The next scroll to the end retries the page
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loading, loadingMore, total, fetchPage]);

  return { section, chips, products, total, loading, loadingMore, failed, loadMore };
}
