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

function BrandPill({ brand, selected, onPress }: { brand: BrandTile; selected: boolean; onPress: () => void }) {
  const [background, ink] = wordmarkColors(brand.name);
  return (
    <TouchableOpacity
      style={[styles.pill, brand.imageUrl ? styles.logoPill : { backgroundColor: background }, selected && styles.pillSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={brand.name}
    >
      {brand.imageUrl ? (
        <Image source={{ uri: brand.imageUrl }} style={styles.logo} resizeMode="contain" />
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
  logoPill: { backgroundColor: "#fff", paddingHorizontal: 10 },
  pillSelected: { borderColor: colors.primary },
  wordmark: { fontFamily: fonts.extrabold, fontSize: 15, letterSpacing: -0.2 },
  logo: { width: 88, height: 36 },
  visit: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 12, marginLeft: 16, minHeight: 32 },
  visitText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
