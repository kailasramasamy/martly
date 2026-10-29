import { useEffect, useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../lib/api";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { ProductActionsProvider } from "../../lib/product-actions";
import { colors, spacing, fontSize } from "../../constants/theme";
import { ProductList } from "../../components/ProductList";
import { BrandChip, BrandHeader, showsBrandFilter } from "../../components/BrandFilter";
import { FilterSheet } from "../../components/search/FilterSheet";
import { brandsFromProducts } from "../../lib/brand-strip";
import { FloatingCart } from "../../components/FloatingCart";
import { ProductCardSkeleton } from "../../components/SkeletonLoader";
import type { Store, StoreProduct } from "../../lib/types";

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getLocalizedName } = useLanguage();
  const t = useStrings("search");
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [brandIds, setBrandIds] = useState<string[]>([]);
  const [brandSheet, setBrandSheet] = useState(false);

  const categories = useMemo(() => {
    const catMap = new Map<string, string>();
    for (const p of products) {
      if (p.product.subcategory) {
        catMap.set(p.product.subcategory.id, getLocalizedName(p.product.subcategory));
      }
    }
    return Array.from(catMap.entries()).map(([cid, name]) => ({ id: cid, name }));
  }, [products, getLocalizedName]);

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
    () => (brandIds.length ? filteredProducts.filter((p) => brandIds.includes(p.product.brand?.id ?? "")) : filteredProducts),
    [filteredProducts, brandIds],
  );

  useEffect(() => setBrandIds([]), [activeCategory]);

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
    <ProductActionsProvider store={store}>
      <View style={styles.container}>
        {store && (
          <View style={styles.header}>
            <Text style={styles.storeName}>{getLocalizedName(store)}</Text>
            <Text style={styles.storeAddress}>{store.address}</Text>
          </View>
        )}

        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillBar} contentContainerStyle={styles.pillBarContent}>
            <TouchableOpacity
              style={[styles.pill, !activeCategory && styles.pillActive]}
              onPress={() => setActiveCategory(null)}
            >
              <Text style={[styles.pillText, !activeCategory && styles.pillTextActive]}>{t.all}</Text>
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

        <Text style={styles.sectionTitle}>{t.products}</Text>
        <TextInput
          style={styles.filterInput}
          placeholder={t.filterProducts}
          value={filterText}
          onChangeText={setFilterText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {showsBrandFilter({ brands: brandTiles, selectedIds: brandIds }) && (
          <View style={styles.chipRow}>
            <BrandChip brands={brandTiles} selectedIds={brandIds} onPress={() => setBrandSheet(true)} />
          </View>
        )}
        <ProductList
          products={visibleProducts}
          layout="grid"
          ListHeaderComponent={<BrandHeader brands={brandTiles} selectedIds={brandIds} onChange={setBrandIds} bleed={spacing.md} />}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.grid}
          ListEmptyComponent={<Text style={styles.empty}>{t.noProductsAvailable}</Text>}
        />
        <FloatingCart />
        <FilterSheet
          visible={brandSheet} brandsOnly brands={brandTiles} value={{ brandIds, foodType: null }}
          onApply={(v) => setBrandIds(v.brandIds)} onClose={() => setBrandSheet(false)}
        />
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
  chipRow: { flexDirection: "row", marginHorizontal: spacing.md, marginBottom: spacing.sm },
  grid: { paddingBottom: spacing.md },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: spacing.xl },
});