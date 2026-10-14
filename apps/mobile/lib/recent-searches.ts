import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SearchEventType } from "@martly/shared/constants";
import { api } from "./api";

const STORAGE_KEY = "martly_recent_searches";
const MAX_RECENT = 8;

/** Recent searches live on the device so guests get them too; newest first, de-duplicated. */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setRecent(JSON.parse(raw) as string[]);
    });
  }, []);

  const save = useCallback((update: (prev: string[]) => string[]) => {
    setRecent((prev) => {
      const next = update(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const add = useCallback((query: string) => save((prev) => {
    const q = query.trim();
    return [q, ...prev.filter((p) => p.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
  }), [save]);
  const remove = useCallback((query: string) => save((prev) => prev.filter((p) => p !== query)), [save]);
  const clear = useCallback(() => save(() => []), [save]);

  return { recent, add, remove, clear };
}

// Feeds "Trending near you" and result tracking; best-effort, a failed log must never disturb searching
export function logSearch(storeId: string, query: string, resultCount: number): Promise<string | null> {
  return api.post<{ id: string }>("/api/v1/search/log", { storeId, query, resultCount })
    .then((res) => res.data.id)
    .catch(() => null);
}

// A result tapped or added from a logged search; position is its 0-based place in the results
export function logSearchEvent(searchLogId: string, productId: string, type: SearchEventType, position: number) {
  api.post("/api/v1/search/event", { searchLogId, productId, type, position }).catch(() => {});
}
