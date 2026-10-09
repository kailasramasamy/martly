import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts } from "../constants/theme";
import { MIN_BRANDS_FOR_STRIP, type BrandTile } from "../lib/brand-strip";

const TILE_SIZE = 72;

interface ShopByBrandsProps {
  brands: BrandTile[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase();
}

function BrandItem({ brand, selected, onPress }: { brand: BrandTile; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={brand.name}
    >
      <View style={[styles.tile, selected && styles.tileSelected]}>
        {brand.imageUrl ? (
          <Image source={{ uri: brand.imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.initials}>{initials(brand.name)}</Text>
        )}
      </View>
      <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={2}>{brand.name}</Text>
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
          <BrandItem brand={item} selected={item.id === selectedId} onPress={() => onSelect(item.id === selectedId ? null : item.id)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: "#fdf8ee", paddingVertical: 16, marginBottom: 12 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, paddingHorizontal: 16, marginBottom: 12 },
  list: { flexGrow: 0, flexShrink: 0 },
  listContent: { paddingHorizontal: 16, gap: 12 },
  item: { width: 80, alignItems: "center", minHeight: 44 },
  tile: {
    width: TILE_SIZE, height: TILE_SIZE, borderRadius: 14, backgroundColor: "#fff",
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", padding: 8,
  },
  tileSelected: { borderWidth: 2, borderColor: colors.primary },
  image: { width: "100%", height: "100%" },
  initials: { fontFamily: fonts.bold, fontSize: 20, color: colors.primary },
  name: { fontFamily: fonts.medium, fontSize: 12, color: colors.text, textAlign: "center", marginTop: 6 },
  nameSelected: { fontFamily: fonts.bold },
});
