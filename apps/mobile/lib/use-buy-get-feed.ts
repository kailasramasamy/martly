import { useCallback } from "react";
import { BUY_GET_PAGE_SIZE } from "@martly/shared/constants";
import type { PriceBandPage } from "@martly/shared/types";
import { useChipPages } from "./use-chip-pages";
import type { StoreProduct } from "./types";

/** The store's buy X get Y offers for one category chip, a page at a time */
export function useBuyGetFeed(storeId: string | undefined, categoryId: string | null) {
  const pathFor = useCallback(
    (p: number) => `/api/v1/home/${storeId}/buy-get?page=${p}` + (categoryId ? `&categoryId=${categoryId}` : ""),
    [storeId, categoryId],
  );
  return useChipPages<PriceBandPage<StoreProduct>>(storeId ? pathFor : null, BUY_GET_PAGE_SIZE);
}
