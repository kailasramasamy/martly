import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { fonts, colors } from "../../../constants/theme";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { SearchField } from "../ui/SearchField";
import { EmptyState } from "../ui/EmptyState";
import { FacetChips, type SearchFacetsMeta } from "../ui/FacetChips";
import { Button } from "../ui/Button";
import { StatusPill } from "../ui/StatusPill";
import { manage } from "../ui/tokens";
import { ProductTile } from "./ProductTile";
import { storeListing } from "./store-listing";
import type { CatalogProduct } from "./types";

interface ProductPickerProps {
  onPick: (product: CatalogProduct) => void;
  /** Mark results already listed in this store ("In store" / "Partly in store") */
  storeId?: string | null;
  onQueryChange?: (q: string) => void;
}

const LISTING_BADGE = {
  full: { label: "In store", color: "#15803d", bg: "#dcfce7" },
  partial: { label: "Some sizes", color: manage.attentionText, bg: manage.attentionBg },
} as const;

function ListingBadge({ product, storeId }: { product: CatalogProduct; storeId?: string | null }) {
  if (!storeId) return null;
  const { state } = storeListing(product, storeId);
  return state === "none" ? null : <StatusPill {...LISTING_BADGE[state]} />;
}

const COLUMNS = 3;
const GAP = 8;

/** Search the product catalog and tap a result to choose it */
export function ProductPicker({ onPick, storeId, onQueryChange }: ProductPickerProps) {
  const [q, setQ] = useState("");
  // Subcategory and brand chips from the search breakdown; a new search starts unfiltered
  const [facet, setFacet] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  useEffect(() => { setFacet(null); setBrand(null); }, [q]);
  const searching = q.trim().length >= 2;
  const params = {
    q: q.trim(),
    ...(storeId ? { includeStoreProducts: "true" } : {}),
    ...(facet ? { subcategoryId: facet } : {}),
    ...(brand ? { brandId: brand } : {}),
  };
  const list = usePagedList<CatalogProduct, SearchFacetsMeta>("/api/v1/products", params, { pageSize: 24, enabled: searching });
  const [gridWidth, setGridWidth] = useState(0);
  const tileWidth = Math.floor((gridWidth - GAP * (COLUMNS - 1)) / COLUMNS);
  const changeQuery = (text: string) => {
    setQ(text);
    onQueryChange?.(text);
  };

  return (
    <View style={styles.root}>
      <SearchField value={q} onChange={changeQuery} placeholder="Search the catalog by name or brand" />
      {searching && <FacetChips facets={list.meta?.facets?.subcategories} value={facet} onChange={setFacet} />}
      {searching && <FacetChips facets={list.meta?.facets?.brands} value={brand} onChange={setBrand} allLabel="All brands" />}
      {!searching && <Text style={styles.hint}>Type at least 2 letters to search.</Text>}
      {searching && list.error ? <EmptyState icon="cloud-offline-outline" title="Couldn't search" message={list.error} /> : null}
      {searching && !list.loading && !list.error && list.items.length === 0 ? (
        <EmptyState icon="search-outline" title="No products found" message="Try another name or brand." />
      ) : null}
      <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
        {searching && tileWidth > 0 && list.items.map((p) => (
          <ProductTile key={p.id} product={p} width={tileWidth} badge={<ListingBadge product={p} storeId={storeId} />} onPress={() => onPick(p)} />
        ))}
      </View>
      {searching && list.items.length < list.total && (
        <Button label="Show more" variant="secondary" onPress={list.loadMore} loading={list.loadingMore} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  hint: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, textAlign: "center", paddingVertical: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
});
