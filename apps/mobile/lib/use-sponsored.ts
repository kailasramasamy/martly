import { useCallback, useEffect } from "react";
import { recordBannerTap, recordBannerView } from "./banner-events";
import { useStore } from "./store-context";
import type { StoreProduct } from "./types";

/** Counts a sponsored product through its banner: a view once it renders, a tap via the returned callback */
export function useSponsoredTracking(sponsored: StoreProduct["sponsored"], storeId?: string) {
  const contextStoreId = useStore().selectedStore?.id;
  const store = storeId ?? contextStoreId;
  const bannerId = sponsored?.bannerId;
  useEffect(() => {
    if (bannerId) recordBannerView(store, bannerId);
  }, [store, bannerId]);
  return useCallback(() => {
    if (bannerId) recordBannerTap(store, bannerId);
  }, [store, bannerId]);
}
