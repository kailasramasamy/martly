import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { useWishlist } from "../lib/wishlist-context";
import { useAuth } from "../lib/auth-context";
import { ProductActionsProvider } from "../lib/product-actions";
import { colors, spacing, fontSize } from "../constants/theme";
import { ProductList } from "../components/ProductList";
import { FloatingCart } from "../components/FloatingCart";
import type { StoreProduct } from "../lib/types";

function EmptyState({ title, text }: { title?: string; text: string }) {
  return (
    <View style={styles.center}>
      <Ionicons name="heart-outline" size={48} color="#94a3b8" />
      {title && <Text style={styles.emptyTitle}>{title}</Text>}
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export default function WishlistScreen() {
  const { isAuthenticated } = useAuth();
  const { selectedStore } = useStore();
  const { wishlistedIds } = useWishlist();
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
      .then((res) => setProducts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, storeId, wishlistedIds]);

  if (!isAuthenticated) return <EmptyState text="Sign in to see your wishlist" />;
  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (products.length === 0) {
    return <EmptyState title="Your wishlist is empty" text="Products you love will appear here" />;
  }

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={styles.container}>
        <ProductList products={products} layout="grid" contentContainerStyle={styles.list} />
        <FloatingCart />
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.surface, padding: spacing.lg },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginTop: spacing.md },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  list: { paddingTop: spacing.md, paddingBottom: 80 },
});
