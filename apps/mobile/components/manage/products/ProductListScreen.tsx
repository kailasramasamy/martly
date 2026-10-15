import { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { can } from "@martly/shared/permissions";
import { colors, fonts } from "../../../constants/theme";
import { useAuth } from "../../../lib/auth-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../ManageListScreen";
import { HeaderAction } from "../HeaderAction";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { FacetChips, type SearchFacetsMeta } from "../ui/FacetChips";
import { useTaxonomy } from "../taxonomy/use-taxonomy";
import { selectionFilter } from "../taxonomy/selection";
import { ProductTile } from "../inventory/ProductTile";
import { CatalogPill } from "./CatalogPill";
import { ProductFilterSheet, NO_FILTERS, type ProductFilters } from "./ProductFilterSheet";
import { useBrandOptions } from "./use-brand-options";
import type { CatalogFilter, ProductListItem } from "./types";

const CATALOG_TABS = [
  { value: "all" as const, label: "All" },
  { value: "master" as const, label: "Master catalog" },
  { value: "org" as const, label: "Our products" },
];

function activeFilterCount(f: ProductFilters): number {
  return Object.keys(selectionFilter(f.selection)).length + (f.brandId ? 1 : 0);
}

function FilterButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.filterBtn} onPress={onPress} accessibilityRole="button">
      <Ionicons name="options-outline" size={18} color={colors.primary} />
      <Text style={styles.filterText}>{count > 0 ? `Filters (${count})` : "Filters"}</Text>
    </TouchableOpacity>
  );
}

function useProductList() {
  const [q, setQ] = useState("");
  const [catalog, setCatalog] = useState<CatalogFilter>("all");
  const [filters, setFilters] = useState<ProductFilters>(NO_FILTERS);
  // Subcategory and brand chips from the search breakdown; a new search starts unfiltered
  const [facet, setFacet] = useState<string | null>(null);
  const [brandFacet, setBrandFacet] = useState<string | null>(null);
  useEffect(() => { setFacet(null); setBrandFacet(null); }, [q]);
  const params = useMemo(
    () => ({
      q, brandId: filters.brandId || brandFacet || "", ...selectionFilter(filters.selection),
      ...(facet ? { subcategoryId: facet } : {}),
      catalogType: catalog === "all" ? "" : catalog,
    }),
    [q, filters, catalog, facet, brandFacet],
  );
  const list = usePagedList<ProductListItem, SearchFacetsMeta>("/api/v1/products", params);
  return { q, setQ, catalog, setCatalog, filters, setFilters, facet, setFacet, brandFacet, setBrandFacet, list };
}

export function ProductListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { tree } = useTaxonomy();
  const brandOptions = useBrandOptions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { q, setQ, catalog, setCatalog, filters, setFilters, facet, setFacet, brandFacet, setBrandFacet, list } = useProductList();
  const role = user?.role ?? "";
  const canCreate = can(role, "products", "create") || can(role, "catalog-drafts", "create") || can(role, "store-products", "create");

  return (
    <>
      <ManageListScreen
        title="Products"
        list={list}
        search={{ value: q, onChange: setQ, placeholder: "Search products or brands" }}
        headerRight={canCreate ? () => <HeaderAction onPress={() => router.push("/manage/add-product")} accessibilityLabel="Add product" /> : undefined}
        filters={
          <>
            <View style={styles.filters}>
              <View style={styles.tabs}><SegmentedTabs options={CATALOG_TABS} value={catalog} onChange={setCatalog} /></View>
              <FilterButton count={activeFilterCount(filters)} onPress={() => setSheetOpen(true)} />
            </View>
            {q ? <FacetChips facets={list.meta?.facets?.subcategories} value={facet} onChange={setFacet} /> : null}
            {q && !filters.brandId ? <FacetChips facets={list.meta?.facets?.brands} value={brandFacet} onChange={setBrandFacet} allLabel="All brands" /> : null}
          </>
        }
        empty={{ icon: "cube-outline", title: "No products found", message: "Try a different search or clear the filters." }}
        columns={3}
        collapseToolbar
        renderItem={(p, cell) => (
          <ProductTile
            product={p}
            width={cell.width}
            badge={<CatalogPill organizationId={p.organizationId} />}
            dimmed={!p.isActive}
            onPress={() => router.push(`/manage/products/${p.id}`)}
          />
        )}
      />
      <ProductFilterSheet
        visible={sheetOpen}
        value={filters}
        tree={tree}
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
  filters: { flexDirection: "row", alignItems: "center", gap: 8 },
  tabs: { flex: 1 },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 8 },
  filterText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
