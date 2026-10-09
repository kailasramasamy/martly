import { useEffect, useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../lib/api";
import { ProductActionsProvider } from "../../lib/product-actions";
import { colors, spacing, fontSize } from "../../constants/theme";
import { ProductList } from "../../components/ProductList";
import { ShopByBrands } from "../../components/ShopByBrands";
import { brandsFromProducts } from "../../lib/brand-strip";
import { FloatingCart } from "../../components/FloatingCart";
import { ProductCardSkeleton } from "../../components/SkeletonLoader";
import type { Store, StoreProduct } from "../../lib/types";

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const catMap = new Map<string, string>();
    for (const p of products) {
      if (p.product.subcategory) {
        catMap.set(p.product.subcategory.id, p.product.subcategory.name);
      }
    }
    return Array.from(catMap.entries()).map(([cid, name]) => ({ id: cid, name }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory) {
      result = result.filter((p) => p.product.subcategory?.id === activeCategory);
    }
    if (filterText) {
      result = result.filter((p) => p.product.name.toLowerCase().includes(filterText.toLowerCase()));
    }
    return result;
  }, [products, filterText, activeCategory]);

  const brandTiles = useMemo(() => brandsFromProducts(filteredProducts), [filteredProducts]);
  const visibleProducts = useMemo(
    () => (brandId ? filteredProducts.filter((p) => p.product.brand?.id === brandId) : filteredProducts),
    [filteredProducts, brandId],
  );

  useEffect(() => setBrandId(null), [activeCategory]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Store>(`/api/v1/stores/${id}`),
      api.getList<StoreProduct>(`/api/v1/stores/${id}/products`),
    ])
      .then(([storeRes, productsRes]) => {
        setStore(storeRes.data);
        setProducts(productsRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonHeader} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.skeletonPad}>
            <ProductCardSkeleton />
          </View>
        ))}
      </View>
    );
  }

  return (
    <ProductActionsProvider store={store && id ? { id, name: store.name } : null}>
      <View style={styles.container}>
        {store && (
          <View style={styles.header}>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.storeAddress}>{store.address}</Text>
          </View>
        )}

        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillBar} contentContainerStyle={styles.pillBarContent}>
            <TouchableOpacity
              style={[styles.pill, !activeCategory && styles.pillActive]}
              onPress={() => setActiveCategory(null)}
            >
              <Text style={[styles.pillText, !activeCategory && styles.pillTextActive]}>All</Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.pill, activeCategory === cat.id && styles.pillActive]}
                onPress={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              >
                <Text style={[styles.pillText, activeCategory === cat.id && styles.pillTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={styles.sectionTitle}>Products</Text>
        <TextInput
          style={styles.filterInput}
          placeholder="Filter products..."
          value={filterText}
          onChangeText={setFilterText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {brandId && (
          <TouchableOpacity style={styles.brandChip} onPress={() => setBrandId(null)} activeOpacity={0.7}>
            <Text style={styles.brandChipText}>{brandTiles.find((b) => b.id === brandId)?.name}</Text>
            <Ionicons name="close" size={14} color="#fff" />
          </TouchableOpacity>
        )}
        <ProductList
          products={visibleProducts}
          layout="grid"
          midSlot={{
            afterRows: 2,
            bleed: spacing.md,
            element: <ShopByBrands brands={brandTiles} selectedId={brandId} onSelect={setBrandId} />,
          }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.grid}
          ListEmptyComponent={<Text style={styles.empty}>No products available</Text>}
        />
        <FloatingCart />
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  skeletonHeader: { height: 60, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  skeletonPad: { paddingHorizontal: spacing.md },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  storeName: { fontSize: fontSize.xl, fontWeight: "bold", color: colors.text },
  storeAddress: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  pillBar: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.border },
  pillBarContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: fontSize.sm, color: colors.text },
  pillTextActive: { color: "#fff", fontWeight: "600" },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, padding: spacing.md, paddingBottom: 0 },
  filterInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: spacing.sm, margin: spacing.md, fontSize: fontSize.md, backgroundColor: colors.surface,
  },
  brandChip: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, height: 30,
    marginHorizontal: spacing.md, marginBottom: spacing.sm, paddingHorizontal: 10,
    borderRadius: 16, backgroundColor: colors.primary,
  },
  brandChipText: { fontSize: fontSize.sm, color: "#fff", fontWeight: "600" },
  grid: { paddingBottom: spacing.md },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: spacing.xl },
});