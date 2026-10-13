import { useEffect, useState } from "react";
import { api } from "./api";
import type { SearchSuggestions } from "./types";

const DEBOUNCE_MS = 120;
const CACHE_LIMIT = 100;
// Module-level so reopening the panel for a query already seen is instant
const cache = new Map<string, SearchSuggestions>();

const EMPTY: SearchSuggestions = { suggestions: [] };

/** Typeahead for the selected store; quicker than the results debounce so suggestions lead the grid. */
export function useSearchSuggestions(storeId: string | undefined, query: string) {
  const q = query.trim().toLowerCase();
  const key = `${storeId}:${q}`;
  const [data, setData] = useState<SearchSuggestions>(() => cache.get(key) ?? EMPTY);

  useEffect(() => {
    if (!storeId || q.length < 2) {
      setData(EMPTY);
      return;
    }
    const hit = cache.get(key);
    if (hit) {
      setData(hit);
      return;
    }
    let stale = false;
    const t = setTimeout(() => {
      api.get<SearchSuggestions>(`/api/v1/search/suggest?storeId=${storeId}&q=${encodeURIComponent(q)}`)
        .then((res) => {
          if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
          cache.set(key, res.data);
          if (!stale) setData(res.data);
        })
        .catch(() => {
          if (!stale) setData(EMPTY);
        });
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [storeId, q, key]);

  return data;
}

