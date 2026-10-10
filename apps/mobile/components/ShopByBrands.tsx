import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts } from "../constants/theme";
import { MIN_BRANDS_FOR_STRIP, type BrandTile } from "../lib/brand-strip";

interface ShopByBrandsProps {
  brands: BrandTile[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

// Pastel background + matching ink per brand, picked stably from the brand name
const WORDMARK_COLORS = [
  ["#fde7d3", "#9a3412"], ["#e0f2fe", "#075985"], ["#dcfce7", "#166534"], ["#fef3c7", "#92400e"],
  ["#ede9fe", "#5b21b6"], ["#fce7f3", "#9d174d"], ["#ccfbf1", "#115e59"], ["#fee2e2", "#991b1b"],
];

function wordmarkColors(name: string) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  return WORDMARK_COLORS[hash % WORDMARK_COLORS.length];
}

// "Fortune (Adani Wilmar)" → "Fortune": the parenthetical is the parent company
const displayName = (name: string) => name.replace(/\s*\(.*\)\s*/g, " ").trim();

function BrandPill({ brand, selected, onPress }: { brand: BrandTile; selected: boolean; onPress: () => void }) {
  const [background, ink] = wordmarkColors(brand.name);
  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: background }, selected && styles.pillSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={brand.name}
    >
      <Text style={[styles.wordmark, { color: ink }]} numberOfLines={1}>{displayName(brand.name)}</Text>
    </TouchableOpacity>
  );
}

export function ShopByBrands({ brands, selectedId, onSelect }: ShopByBrandsProps) {
  if (brands.length < MIN_BRANDS_FOR_STRIP) return null;
  return (
    <View style={styles.band}>
      <Text style={styles.title}>Shop by brands</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: "#fdf8ee", paddingVertical: 16, marginBottom: 12 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, paddingHorizontal: 16, marginBottom: 12 },
  list: { flexGrow: 0, flexShrink: 0 },
  listContent: { paddingHorizontal: 16, gap: 10 },
  pill: {
    height: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: "center",
    borderWidth: 2, borderColor: "transparent",
  },
  pillSelected: { borderColor: colors.primary },
  wordmark: { fontFamily: fonts.extrabold, fontSize: 15, letterSpacing: -0.2 },
});
