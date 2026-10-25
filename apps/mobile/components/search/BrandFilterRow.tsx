import { useRef } from "react";
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
  const list = useRef<FlatList<BrandFilterRowProps["brands"][number]>>(null);
  if (brands.length < MIN_BRANDS && selectedIds.length === 0) return null;
  // The picked brand slides fully into view, so a pill tapped at the edge isn't left half hidden
  const toggle = (id: string, index: number) => {
    const picking = !(selectedIds.length === 1 && selectedIds[0] === id);
    onChange(picking ? [id] : []);
    if (picking) list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  };
  return (
    <FlatList
      ref={list}
      horizontal
      // A pill not laid out yet: aim by the average pill width instead
      onScrollToIndexFailed={({ index, averageItemLength }) => list.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })}
      data={brands}
      keyExtractor={(b) => b.id}
      showsHorizontalScrollIndicator={false}
      style={styles.list}
      contentContainerStyle={styles.row}
      renderItem={({ item, index }) => <BrandPill brand={item} selected={selectedIds.includes(item.id)} onPress={() => toggle(item.id, index)} outlined />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: 6 },
});
