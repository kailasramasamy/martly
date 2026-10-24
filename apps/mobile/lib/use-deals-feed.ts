import { useCallback } from "react";
import { HOME_DEALS_PAGE_SIZE } from "@martly/shared/constants";
import type { PriceBandDealsPage } from "@martly/shared/types";
import { useChipPages } from "./use-chip-pages";
import type { StoreProduct } from "./types";

/** A price-band deals section's products for one band and category chip, a page at a time */
export function useDealsFeed(storeId: string | undefined, sectionId: string, band: number, categoryId: string | null) {
  const pathFor = useCallback(
    (p: number) => `/api/v1/home/${storeId}/deals?sectionId=${sectionId}&band=${band}&page=${p}`
      + (categoryId ? `&categoryId=${categoryId}` : ""),
    [storeId, sectionId, band, categoryId],
  );
  const feed = useChipPages<PriceBandDealsPage<StoreProduct>>(storeId ? pathFor : null, HOME_DEALS_PAGE_SIZE);
  return { ...feed, section: feed.first?.section ?? null };
}
