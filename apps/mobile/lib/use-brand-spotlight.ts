import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { BrandSpotlight } from "@martly/shared/types";
import { api } from "./api";

// Tab bars to refetch when Home is pulled to refresh
const listeners = new Set<() => void>();

/** Refetches the tab bar's brand, so a pull on Home picks up a newly booked tab slot or the day's rotation */
export function refreshBrandSpotlight() {
  listeners.forEach((refetch) => refetch());
}

/**
 * The brand featured in the tab bar for this store; null while loading or when the store has none. Refetched when
 * Home is pulled and when the app comes back to the foreground, keeping the current logo until the new one arrives.
 */
export function useBrandSpotlight(storeId: string | undefined) {
  const [spotlight, setSpotlight] = useState<BrandSpotlight | null>(null);
  // A reply for a store the shopper has since left is dropped
  const current = useRef(storeId);
  current.current = storeId;
  const refetch = useCallback(() => {
    if (!storeId) return;
    api.get<BrandSpotlight | null>(`/api/v1/brands/store/${storeId}/spotlight`)
      .then((res) => { if (current.current === storeId) setSpotlight(res.data); })
      .catch(() => {});
  }, [storeId]);

  useEffect(() => {
    setSpotlight(null);
    refetch();
    listeners.add(refetch);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refetch();
    });
    return () => {
      listeners.delete(refetch);
      sub.remove();
    };
  }, [refetch]);
  return spotlight;
}
