import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import type { SearchLanding } from "./types";

// Bump the version whenever the SearchLanding shape changes so a cached payload from an older build is never painted
const CACHE_VERSION = 3;
const cacheKey = (storeId: string) => `martly_search_landing_v${CACHE_VERSION}_${storeId}`;

/** Paints the last landing for this store instantly, then refreshes it from the API. */
export function useSearchLanding(storeId: string | undefined, enabled: boolean) {
  const [data, setData] = useState<SearchLanding | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId || !enabled) return;
    let cancelled = false;
    setLoading(true);
    AsyncStorage.getItem(cacheKey(storeId)).then((raw) => {
      if (raw && !cancelled) setData((current) => current ?? (JSON.parse(raw) as SearchLanding));
    });
    api.get<SearchLanding>(`/api/v1/search/landing?storeId=${storeId}`)
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        AsyncStorage.setItem(cacheKey(storeId), JSON.stringify(res.data));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [storeId, enabled]);

  return { data, loading };
}
