import { useEffect, useState, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../lib/api";
import { useCart } from "../../lib/cart-context";
import { colors, spacing, fontSize } from "../../constants/theme";

interface Store {
  id: string;
  name: string;
  address: string;
  phone: string | null;
}

interface StoreProduct {
  id: string;
  price: number;
  product: {
    id: string;
    name: string;
    description: string | null;
  };
}

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { storeId: cartStoreId, addItem } = useCart();
  const [addedId, setAddedId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

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

    const item = {
      storeProductId: sp.id,
      productName: sp.product.name,
      price: Number(sp.price),
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
    setAddedId(sp.id);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAddedId(null), 1200);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
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
      <Text style={styles.sectionTitle}>Products</Text>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.productName}>{item.product.name}</Text>
              <Text style={styles.price}>${Number(item.price).toFixed(2)}</Text>
            </View>
            {item.product.description && (
              <Text style={styles.description}>{item.product.description}</Text>
            )}
            <TouchableOpacity
              style={[styles.addButton, addedId === item.id && styles.addedButton]}
              onPress={() => handleAddToCart(item)}
            >
              <Text style={styles.addButtonText}>
                {addedId === item.id ? "Added!" : "Add to Cart"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No products available</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  storeName: { fontSize: fontSize.xl, fontWeight: "bold", color: colors.text },
  storeAddress: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, padding: spacing.md },
  list: { paddingHorizontal: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  productName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text, flex: 1 },
  price: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.primary },
  description: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  addButton: {
    backgroundColor: colors.primary, borderRadius: 6, paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md, alignSelf: "flex-end", marginTop: spacing.sm,
  },
  addedButton: { backgroundColor: colors.success },
  addButtonText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600" },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: spacing.xl },
});
