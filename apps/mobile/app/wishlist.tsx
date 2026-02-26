import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { useCart } from "../lib/cart-context";
import { useWishlist } from "../lib/wishlist-context";
import { useAuth } from "../lib/auth-context";
import { colors, spacing, fontSize } from "../constants/theme";
import { ProductGridCard, GRID_GAP, GRID_H_PADDING } from "../components/ProductGridCard";
import { FloatingCart } from "../components/FloatingCart";
import type { StoreProduct } from "../lib/types";

export default function WishlistScreen() {
  const { isAuthenticated } = useAuth();
  const { selectedStore } = useStore();
  const { storeId: cartStoreId, items: cartItems, addItem, updateQuantity } = useCart();
  const { wishlistedIds, isWishlisted, toggle: toggleWishlist } = useWishlist();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const storeId = selectedStore?.id;

  useEffect(() => {
    if (!isAuthenticated || !storeId || wishlistedIds.size === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ids = Array.from(wishlistedIds).join(",");
    api.getList<StoreProduct>(`/api/v1/stores/${storeId}/products?productIds=${ids}&pageSize=200`)
      .then((res) => {
        setProducts(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, storeId, wishlistedIds]);

  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) map.set(item.storeProductId, item.quantity);
    return map;
  }, [cartItems]);

  const handleAddToCart = useCallback((sp: StoreProduct) => {
    if (!storeId) return;
    const effectivePrice = sp.pricing?.discountActive ? sp.pricing.effectivePrice : Number(sp.price);
    addItem(storeId, selectedStore?.name ?? "", {
      storeProductId: sp.id,
      productId: sp.product.id,
      productName: sp.product.name,
      variantId: sp.variant.id,
      variantName: sp.variant.name,
      price: effectivePrice,
      imageUrl: sp.product.imageUrl ?? sp.variant.imageUrl,
    });
  }, [storeId, selectedStore, addItem]);

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Ionicons name="heart-outline" size={48} color="#94a3b8" />
        <Text style={styles.emptyText}>Sign in to see your wishlist</Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (products.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="heart-outline" size={48} color="#94a3b8" />
        <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
        <Text style={styles.emptyText}>Products you love will appear here</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        extraData={wishlistedIds}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ProductGridCard
            item={item}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={updateQuantity}
            quantity={cartQuantityMap.get(item.id) ?? 0}
            storeId={storeId}
            isWishlisted={isWishlisted(item.product.id)}
            onToggleWishlist={toggleWishlist}
          />
        )}
      />
      <FloatingCart />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.surface, padding: spacing.lg },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginTop: spacing.md },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  list: { padding: GRID_H_PADDING, paddingBottom: 80 },
  row: { gap: GRID_GAP },
});
