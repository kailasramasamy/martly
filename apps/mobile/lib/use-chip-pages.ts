import { useCallback, useEffect, useRef, useState } from "react";
import type { PriceBandChip, PriceBandPage } from "@martly/shared/types";
import { api } from "./api";
import type { StoreProduct } from "./types";

/**
 * A product list narrowed by category chips, a page at a time: `pathFor` gives page N's path (null while there is no
 * store), and the first page's whole response comes back as `first` for anything else it carries
 */
export function useChipPages<R extends PriceBandPage<StoreProduct>>(pathFor: ((page: number) => string) | null, pageSize: number) {
  const [first, setFirst] = useState<R | null>(null);
  const [chips, setChips] = useState<PriceBandChip[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const page = useRef(1);
  const request = useRef(0);

  useEffect(() => {
    if (!pathFor) {
      setLoading(false);
      return;
    }
    const id = ++request.current;
    setLoading(true);
    setFailed(false);
    page.current = 1;
    api.get<R>(pathFor(1))
      .then(({ data }) => {
        if (id !== request.current) return;
        setFirst(data);
        setChips(data.chips);
        setProducts(data.products);
        setTotal(data.total);
      })
      .catch(() => { if (id === request.current) setFailed(true); })
      .finally(() => { if (id === request.current) setLoading(false); });
  }, [pathFor]);

  const loadMore = useCallback(() => {
    if (!pathFor || loading || loadingMore || page.current * pageSize >= total) return;
    const id = request.current;
    setLoadingMore(true);
    api.get<R>(pathFor(page.current + 1))
      .then(({ data }) => {
        if (id !== request.current) return;
        page.current += 1;
        setProducts((prev) => [...prev, ...data.products]);
      })
      // The next scroll to the end retries the page
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [pathFor, pageSize, loading, loadingMore, total]);

  return { first, chips, products, total, loading, loadingMore, failed, loadMore };
}
