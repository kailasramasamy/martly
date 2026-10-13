import { FlatList, StyleSheet } from "react-native";
import { spacing } from "../../constants/theme";
import { BrandPill } from "../ShopByBrands";
import type { SearchFacets } from "../../lib/types";

// Fewer brands than this and a brand row adds nothing (e.g. searching "surf excel")
const MIN_BRANDS = 3;

interface BrandFilterRowProps {
  brands: SearchFacets["brands"];
  selectedIds: string[];
  onChange: (brandIds: string[]) => void;
}

// Quick single-brand jump: a tap shows only that brand, a second tap clears it. Several brands → Filters sheet.
export function BrandFilterRow({ brands, selectedIds, onChange }: BrandFilterRowProps) {
  if (brands.length < MIN_BRANDS && selectedIds.length === 0) return null;
  const toggle = (id: string) => onChange(selectedIds.length === 1 && selectedIds[0] === id ? [] : [id]);
  return (
    <FlatList
      horizontal
      data={brands}
      keyExtractor={(b) => b.id}
      showsHorizontalScrollIndicator={false}
      style={styles.list}
      contentContainerStyle={styles.row}
      renderItem={({ item }) => <BrandPill brand={item} selected={selectedIds.includes(item.id)} onPress={() => toggle(item.id)} outlined />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: 6 },
});
