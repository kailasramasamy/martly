import { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../lib/api";
import { useCart } from "../../lib/cart-context";
import { colors, spacing, fontSize } from "../../constants/theme";
import { ProductGridCard, GRID_GAP, GRID_H_PADDING } from "../../components/ProductGridCard";
import { VariantBottomSheet } from "../../components/VariantBottomSheet";
import { FloatingCart } from "../../components/FloatingCart";
import { ProductCardSkeleton } from "../../components/SkeletonLoader";
import type { Store, StoreProduct } from "../../lib/types";

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { storeId: cartStoreId, items: cartItems, addItem, updateQuantity } = useCart();
  const [filterText, setFilterText] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetVariants, setSheetVariants] = useState<StoreProduct[]>([]);

  const categories = useMemo(() => {
    const catMap = new Map<string, string>();
    for (const p of products) {
      if (p.product.category) {
        catMap.set(p.product.category.id, p.product.category.name);
      }
    }
    return Array.from(catMap.entries()).map(([cid, name]) => ({ id: cid, name }));
  }, [products]);

  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      map.set(item.storeProductId, item.quantity);
    }
    return map;
  }, [cartItems]);

  // Group products by product.id — pick cheapest as primary, store all variants
  const { groupedProducts, variantsByProductId } = useMemo(() => {
    let result = products;
    if (activeCategory) {
      result = result.filter((p) => p.product.category?.id === activeCategory);
    }
    if (filterText) {
      result = result.filter((p) => p.product.name.toLowerCase().includes(filterText.toLowerCase()));
    }

    const groups = new Map<string, StoreProduct[]>();
    for (const sp of result) {
      const pid = sp.product.id;
      if (!groups.has(pid)) groups.set(pid, []);
      groups.get(pid)!.push(sp);
    }

    const primary: StoreProduct[] = [];
    const variantsMap = new Map<string, StoreProduct[]>();
    for (const [pid, variants] of groups) {
      const sorted = [...variants].sort((a, b) => {
        const priceA = a.pricing?.discountActive ? a.pricing.effectivePrice : Number(a.price);
        const priceB = b.pricing?.discountActive ? b.pricing.effectivePrice : Number(b.price);
        return priceA - priceB;
      });
      primary.push(sorted[0]);
      variantsMap.set(pid, sorted);
    }

    return { groupedProducts: primary, variantsByProductId: variantsMap };
  }, [products, filterText, activeCategory]);

  const handleShowVariants = useCallback((productId: string) => {
    const variants = variantsByProductId.get(productId);
    if (variants) {
      setSheetVariants(variants);
      setSheetVisible(true);
    }
  }, [variantsByProductId]);

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

  const handleAddToCart = (sp: StoreProduct) => {
    if (!store || !id) return;

    const effectivePrice = sp.pricing?.discountActive
      ? sp.pricing.effectivePrice
      : Number(sp.price);

    const item = {
      storeProductId: sp.id,
      productName: sp.product.name,
      variantId: sp.variant.id,
      variantName: sp.variant.name,
      price: effectivePrice,
      imageUrl: sp.product.imageUrl ?? sp.variant.imageUrl,
    };

    if (cartStoreId && cartStoreId !== id) {
      Alert.alert(
        "Replace Cart?",
        "Your cart has items from another store. Adding this item will replace your current cart.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", style: "destructive", onPress: () => addItem(id, store.name, item) },
        ],
      );
      return;
    }

    addItem(id, store.name, item);
  };

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
      <FlatList
        data={groupedProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => {
          const variants = variantsByProductId.get(item.product.id);
          return (
            <ProductGridCard
              item={item}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={updateQuantity}
              quantity={cartQuantityMap.get(item.id) ?? 0}
              storeId={id}
              variantCount={variants?.length ?? 1}
              onShowVariants={() => handleShowVariants(item.product.id)}
            />
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No products available</Text>}
      />
      <FloatingCart />
      <VariantBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        variants={sheetVariants}
        onAddToCart={handleAddToCart}
        onUpdateQuantity={updateQuantity}
        cartQuantityMap={cartQuantityMap}
      />
    </View>
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
  grid: { paddingHorizontal: GRID_H_PADDING, paddingBottom: spacing.md },
  gridRow: { justifyContent: "space-between" },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: spacing.xl },
});
