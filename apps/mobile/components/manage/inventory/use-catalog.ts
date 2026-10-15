import { useEffect, useState } from "react";
import type { SearchFacetsMeta } from "../ui/FacetChips";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useResource } from "../../../lib/manage/use-resource";
import { useRefreshOnFocus } from "../../../lib/manage/use-refresh-on-focus";
import { FILTER_PARAMS, type CatalogFilter, type StockSummary, type StoreProductItem } from "./types";

/** Store-product list plus stock summary for one store, kept in sync after edits */
export function useCatalog(storeId: string | null) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [facet, setFacet] = useState<string | null>(null);
  useEffect(() => setFacet(null), [search]);
  const summary = useResource<StockSummary>(storeId ? `/api/v1/stock/summary?storeId=${storeId}` : null);
  const list = usePagedList<StoreProductItem, SearchFacetsMeta>(
    "/api/v1/store-products",
    { storeId, q: search, subcategoryId: facet, ...FILTER_PARAMS[filter] },
    { enabled: !!storeId },
  );

  const refreshAll = () => {
    list.refresh();
    summary.reload();
  };
  useRefreshOnFocus(refreshAll);

  return { summary: summary.data, list, search, setSearch, filter, setFilter, facet, setFacet, refreshAll };
}
