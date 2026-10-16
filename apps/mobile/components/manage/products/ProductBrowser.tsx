import { useMemo, useState, type ReactNode } from "react";
import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts } from "../../../constants/theme";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../ManageListScreen";
import { FilterChipBar } from "../ui/FilterChipBar";
import { OptionSheet } from "../ui/OptionSheet";
import type { SearchFacetsMeta } from "../ui/FacetChips";
import { tabular } from "../ui/tokens";
import { useTaxonomy } from "../taxonomy/use-taxonomy";
import { selectionFilter } from "../taxonomy/selection";
import { ProductTile } from "../inventory/ProductTile";
import { ListingPill } from "./ListingPill";
import { useManageScope } from "../../../lib/manage-scope-context";
import { ProductFilterSheet, NO_FILTERS, type ProductFilters } from "./ProductFilterSheet";
import { useBrandOptions } from "./use-brand-options";
import { useFilterChips } from "./use-filter-chips";
import type { ProductListItem } from "./types";

interface ProductBrowserProps {
  title: string;
  searchPlaceholder: string;
  /** Locks the list to one subcategory: search stays inside it and there's no category filter */
  subcategoryId?: string;
  /** Leads the result count, e.g. the subcategory's "Home Care › Laundry" */
  context?: string;
  headerRight?: () => ReactNode;
}

function useProductList(subcategoryId: string | undefined) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<ProductFilters>(NO_FILTERS);
  const params = useMemo(
    () => ({
      q, brandId: filters.brandId, withFacets: true, includeStoreProducts: true,
      ...(subcategoryId ? { subcategoryId } : selectionFilter(filters.selection)),
      catalogType: filters.catalog === "all" ? "" : filters.catalog,
    }),
    [q, filters, subcategoryId],
  );
  const list = usePagedList<ProductListItem, SearchFacetsMeta>("/api/v1/products", params);
  return { q, setQ, filters, setFilters, list };
}

/** Photo grid of catalog products with search and dropdown filter chips */
export function ProductBrowser({ title, searchPlaceholder, subcategoryId, context, headerRight }: ProductBrowserProps) {
  const router = useRouter();
  const { tree } = useTaxonomy();
  const brandOptions = useBrandOptions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { q, setQ, filters, setFilters, list } = useProductList(subcategoryId);
  const { storeId } = useManageScope();
  const bar = useFilterChips({
    filters, setFilters, tree, brandOptions, facets: list.meta?.facets, searching: !!q,
    lockCategory: !!subcategoryId, onOpenAll: () => setSheetOpen(true),
  });
  const count = `${list.total.toLocaleString("en-IN")} ${list.total === 1 ? "product" : "products"}`;

  return (
    <>
      <ManageListScreen
        title={title}
        list={list}
        search={{ value: q, onChange: setQ, placeholder: searchPlaceholder }}
        headerRight={headerRight}
        filters={
          <>
            <FilterChipBar chips={bar.chips} activeCount={bar.activeCount} onOpenAll={() => setSheetOpen(true)} onClear={bar.clear} />
            {/* Always laid out: a toolbar that changes height rebuilds the native collapse animation mid-scroll */}
            <Text style={[styles.count, tabular]} numberOfLines={1}>{list.loading ? " " : [context, count].filter(Boolean).join(" · ")}</Text>
          </>
        }
        empty={{ icon: "cube-outline", title: "No products found", message: "Try a different search or clear the filters." }}
        columns={3}
        collapseToolbar
        renderItem={(p, cell) => (
          <ProductTile
            product={p}
            width={cell.width}
            badge={<ListingPill listings={p.storeProducts} storeId={storeId} />}
            dimmed={!p.isActive}
            onPress={() => router.push(`/manage/products/${p.id}`)}
          />
        )}
      />
      <OptionSheet {...bar.picker} onClose={bar.closePicker} />
      <ProductFilterSheet
        visible={sheetOpen}
        value={filters}
        tree={subcategoryId ? undefined : tree}
        brandOptions={brandOptions}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary, marginTop: -4 },
});
