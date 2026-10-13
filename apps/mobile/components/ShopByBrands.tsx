import { useEffect, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { MIN_BRANDS_FOR_STRIP, brandDisplayName, wordmarkColors, type BrandTile } from "../lib/brand-strip";

interface ShopByBrandsProps {
  brands: BrandTile[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  // When set, a selected brand gets a "Visit <brand> store" link under the strip
  onVisit?: (brand: BrandTile) => void;
  // When set, a "See all" link sits beside the title
  onSeeAll?: () => void;
}

const LOGO_HEIGHT = 36;
const MIN_LOGO_WIDTH = LOGO_HEIGHT;
const MAX_LOGO_WIDTH = 110;
const DEFAULT_LOGO_WIDTH = 88;
// Measured logo widths, kept across renders so pills don't jump when a list re-mounts
const logoWidths = new Map<string, number>();

// Each pill hugs its logo: round marks stay compact, wide wordmarks get room
function useLogoWidth(uri: string | null | undefined) {
  const [width, setWidth] = useState(() => (uri && logoWidths.get(uri)) || DEFAULT_LOGO_WIDTH);
  useEffect(() => {
    if (!uri || logoWidths.has(uri)) return;
    Image.getSize(uri, (w, h) => {
      const fitted = Math.min(MAX_LOGO_WIDTH, Math.max(MIN_LOGO_WIDTH, Math.round((LOGO_HEIGHT * w) / h)));
      logoWidths.set(uri, fitted);
      setWidth(fitted);
    }, () => logoWidths.set(uri, DEFAULT_LOGO_WIDTH));
  }, [uri]);
  return width;
}

// outlined: on a plain white background (the search filter row) the pill needs a visible edge
export function BrandPill({ brand, selected, onPress, outlined = false }: { brand: BrandTile; selected: boolean; onPress: () => void; outlined?: boolean }) {
  const [background, ink] = wordmarkColors(brand.name);
  const logoWidth = useLogoWidth(brand.imageUrl);
  return (
    <TouchableOpacity
      style={[styles.pill, brand.imageUrl ? styles.logoPill : { backgroundColor: background }, outlined && styles.pillOutlined, selected && styles.pillSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={brand.name}
    >
      {brand.imageUrl ? (
        <Image source={{ uri: brand.imageUrl }} style={[styles.logo, { width: logoWidth }]} resizeMode="contain" />
      ) : (
        <Text style={[styles.wordmark, { color: ink }]} numberOfLines={1}>{brandDisplayName(brand.name)}</Text>
      )}
    </TouchableOpacity>
  );
}

export function ShopByBrands({ brands, selectedId, onSelect, onVisit, onSeeAll }: ShopByBrandsProps) {
  if (brands.length < MIN_BRANDS_FOR_STRIP) return null;
  const selected = brands.find((b) => b.id === selectedId);
  return (
    <View style={styles.band}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Shop by brands</Text>
        {onSeeAll && (
          <TouchableOpacity style={styles.seeAll} onPress={onSeeAll} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.visitText}>See all</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        horizontal
        data={brands}
        keyExtractor={(b) => b.id}
        showsHorizontalScrollIndicator={false}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <BrandPill brand={item} selected={item.id === selectedId} onPress={() => onSelect(item.id === selectedId ? null : item.id)} />
        )}
      />
      {selected && onVisit && (
        <TouchableOpacity style={styles.visit} onPress={() => onVisit(selected)} activeOpacity={0.7}>
          <Text style={styles.visitText}>Visit {brandDisplayName(selected.name)} store</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: "#fdf8ee", paddingVertical: 16, marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44, marginVertical: -12, paddingLeft: 12 },
  list: { flexGrow: 0, flexShrink: 0 },
  listContent: { paddingHorizontal: 16, gap: 6 },
  pill: {
    height: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: "center",
    borderWidth: 2, borderColor: "transparent",
  },
  // Clip so logos with their own background (Keventers, RAW) stay inside the rounded pill
  logoPill: { backgroundColor: "#fff", paddingHorizontal: 10, overflow: "hidden" },
  pillOutlined: { borderWidth: 1, borderColor: colors.border },
  pillSelected: { borderWidth: 2, borderColor: colors.primary },
  wordmark: { fontFamily: fonts.extrabold, fontSize: 15, letterSpacing: -0.2 },
  logo: { height: LOGO_HEIGHT },
  visit: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 12, marginLeft: 16, minHeight: 32 },
  visitText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
