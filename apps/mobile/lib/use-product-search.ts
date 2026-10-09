import { useCallback, useEffect, useRef, useState } from "react";
import { SearchSortBy } from "@martly/shared/constants";
import { api } from "./api";
import type { SearchFacets, SearchMeta, StoreProduct } from "./types";

const BROWSE_PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

export interface SearchFilters {
  tag: string | null;
  brandIds: string[];
  size: string | null;
  foodType: string | null;
  offers: boolean;
  sortBy: SearchSortBy;
}

export const EMPTY_FILTERS: SearchFilters = {
  tag: null,
  brandIds: [],
  size: null,
  foodType: null,
  offers: false,
  sortBy: SearchSortBy.RELEVANCE,
};

export interface BrowseParams {
  categoryId?: string;
  hasDiscount?: string;
  sortBy?: string;
}

interface SearchResponse {
  facets?: SearchFacets;
  searchMeta?: SearchMeta;
}

export function hasActiveFilters(f: SearchFilters): boolean {
  return !!(f.tag || f.brandIds.length || f.size || f.foodType || f.offers);
}

function buildPath(storeId: string | undefined, q: string, textMode: boolean, filters: SearchFilters, browse: BrowseParams, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (textMode) {
    if (filters.tag) params.set("tag", filters.tag);
    if (filters.brandIds.length) params.set("brandIds", filters.brandIds.join(","));
    if (filters.size) params.set("size", filters.size);
    if (filters.foodType) params.set("foodType", filters.foodType);
    if (filters.offers) params.set("hasDiscount", "true");
    params.set("sortBy", filters.sortBy);
  } else {
    params.set("page", String(page));
    params.set("pageSize", String(BROWSE_PAGE_SIZE));
    if (browse.categoryId) params.set("categoryId", browse.categoryId);
    if (browse.hasDiscount === "true") params.set("hasDiscount", "true");
    if (browse.sortBy) params.set("sortBy", browse.sortBy);
  }
  const base = storeId ? `/api/v1/stores/${storeId}/products` : "/api/v1/products";
  return `${base}?${params.toString()}`;
}

function useSearchResults(storeId: string | undefined, q: string, textMode: boolean, filters: SearchFilters, browse: BrowseParams, enabled: boolean) {
  const [results, setResults] = useState<StoreProduct[]>([]);
  const [facets, setFacets] = useState<SearchFacets | null>(null);
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const requestId = useRef(0);

  const fetchPage = useCallback((pageNum: number) => {
    const id = ++requestId.current;
    setLoading(true);
    api
      .getList<StoreProduct>(buildPath(storeId, q, textMode, filters, browse, pageNum))
      .then((res) => {
        if (id !== requestId.current) return;
        const extra = res as typeof res & SearchResponse;
        setResults((prev) => (pageNum === 1 ? res.data : [...prev, ...res.data]));
        if (pageNum === 1) {
          setSearchMeta(extra.searchMeta ?? null);
          setFacets(textMode ? extra.facets ?? null : null);
        }
        setHasMore(!textMode && res.data.length === BROWSE_PAGE_SIZE);
      })
      .catch(() => {
        if (id !== requestId.current || pageNum !== 1) return;
        setResults([]);
        setSearchMeta(null);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [storeId, q, textMode, filters, browse.categoryId, browse.hasDiscount, browse.sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1);
    if (enabled) {
      fetchPage(1);
      return;
    }
    requestId.current++;
    setResults([]);
    setFacets(null);
    setSearchMeta(null);
    setLoading(false);
  }, [fetchPage, enabled]);

  const loadMore = () => {
    if (!enabled || textMode || loading || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  };

  return { results, facets, searchMeta, loading, loadMore };
}

/**
 * Text-search mode (query + store, no deep link): one unpaged, server-ranked request with facets and filters.
 * Browse mode (everything else): paged listing driven by deep-link params.
 */
export function useProductSearch(storeId: string | undefined, browse: BrowseParams, initialQuery: string) {
  const isDeepLink = !!(browse.categoryId || browse.hasDiscount || browse.sortBy);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textMode = !!debouncedQuery && !!storeId && !isDeepLink;
  // Nothing to show until the user types or arrives via a deep link
  const fetched = useSearchResults(storeId, debouncedQuery, textMode, filters, browse, !!debouncedQuery || isDeepLink);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const changeQuery = (text: string) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = text.trim();
      if (next === debouncedQuery) return;
      setFilters((f) => ({ ...EMPTY_FILTERS, sortBy: f.sortBy }));
      setDebouncedQuery(next);
    }, DEBOUNCE_MS);
  };

  const patchFilters = (patch: Partial<SearchFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const selectTag = (tag: string | null) => patchFilters({ tag, brandIds: [], size: null });
  const clearFilters = () => setFilters((f) => ({ ...EMPTY_FILTERS, sortBy: f.sortBy }));

  return { query, changeQuery, textMode, filters, patchFilters, selectTag, clearFilters, ...fetched };
}
