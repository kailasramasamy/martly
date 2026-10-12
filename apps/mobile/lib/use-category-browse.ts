import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoryFacets } from "@martly/shared/types";
import { api } from "./api";
import type { StoreProduct } from "./types";

const PAGE_SIZE = 40;

export interface CategoryProductQuery {
  storeId: string | undefined;
  nodeId: string | null;
  onSale: boolean;
  sortBy: "price_asc" | "price_desc" | null;
  brandId: string | null;
  query: string;
  // Subcategory ids under the node: search runs store-wide, so its results are narrowed to these
  scope: Set<string>;
}

function listPath({ storeId, nodeId, onSale, sortBy, brandId }: CategoryProductQuery, page: number): string {
  const params = new URLSearchParams({ categoryId: nodeId ?? "", page: String(page), pageSize: String(PAGE_SIZE) });
  if (onSale) params.set("hasDiscount", "true");
  if (sortBy) params.set("sortBy", sortBy);
  if (brandId) params.set("brandId", brandId);
  return `/api/v1/stores/${storeId}/products?${params}`;
}

// Search returns every match at once, so its filters run here instead of on the server
function narrowSearch(products: StoreProduct[], { scope, onSale, brandId }: CategoryProductQuery): StoreProduct[] {
  return products.filter((p) =>
    scope.has(p.product.subcategory?.id ?? "")
    && (!onSale || p.pricing?.discountActive === true)
    && (!brandId || p.product.brand?.id === brandId));
}

// A category's products a page at a time: the next page is fetched only when the list nears its end
export function useCategoryProducts(q: CategoryProductQuery) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const page = useRef(1);
  const totalPages = useRef(1);
  const request = useRef(0); // drops responses for filters the user has already moved on from
  const term = q.query.trim();

  useEffect(() => {
    if (!q.storeId || !q.nodeId) {
      setLoading(false);
      return;
    }
    const id = ++request.current;
    setLoading(true);
    page.current = 1;
    const path = term ? `/api/v1/stores/${q.storeId}/products?q=${encodeURIComponent(term)}` : listPath(q, 1);
    api.getList<StoreProduct>(path)
      .then((res) => {
        if (id !== request.current) return;
        setProducts(term ? narrowSearch(res.data, q) : res.data);
        totalPages.current = term ? 1 : res.meta.totalPages;
      })
      .catch(() => { if (id === request.current) setProducts([]); })
      .finally(() => { if (id === request.current) setLoading(false); });
  }, [q.storeId, q.nodeId, q.onSale, q.sortBy, q.brandId, term, q.scope]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || page.current >= totalPages.current) return;
    const id = request.current;
    const next = page.current + 1;
    setLoadingMore(true);
    api.getList<StoreProduct>(listPath(q, next))
      .then((res) => {
        if (id !== request.current) return;
        page.current = next;
        setProducts((prev) => [...prev, ...res.data]);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loading, loadingMore, q]);

  return { products, loading, loadingMore, loadMore };
}

// Per-subcategory counts and top brands under a node (null node = not needed)
export function useCategoryFacets(storeId: string | undefined, nodeId: string | null): CategoryFacets | null {
  const [facets, setFacets] = useState<CategoryFacets | null>(null);
  useEffect(() => {
    if (!storeId || !nodeId) return setFacets(null);
    let current = true;
    api.get<CategoryFacets>(`/api/v1/stores/${storeId}/category-facets?categoryId=${nodeId}`)
      .then((res) => { if (current) setFacets(res.data); })
      .catch(() => { if (current) setFacets(null); });
    return () => { current = false; };
  }, [storeId, nodeId]);
  return facets;
}
