import { useEffect, useState, useRef, useMemo } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from "react-native";
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

interface Variant {
  id: string;
  name: string;
  unitType: string;
  unitValue: string;
  mrp: number | null;
}

interface StoreProduct {
  id: string;
  price: number;
  variantId: string;
  variant: Variant;
  product: {
    id: string;
    name: string;
    description: string | null;
    brand: string | null;
    foodType: string | null;
    productType: string | null;
    regulatoryMarks: string[];
    certifications: string[];
    dangerWarnings: string | null;
    category?: { id: string; name: string } | null;
  };
}

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { storeId: cartStoreId, addItem } = useCart();
  const [addedId, setAddedId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Derive categories from store products
  const categories = useMemo(() => {
    const catMap = new Map<string, string>();
    for (const p of products) {
      if (p.product.category) {
        catMap.set(p.product.category.id, p.product.category.name);
      }
    }
    return Array.from(catMap.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory) {
      result = result.filter((p) => p.product.category?.id === activeCategory);
    }
    if (filterText) {
      result = result.filter((p) => p.product.name.toLowerCase().includes(filterText.toLowerCase()));
    }
    return result;
  }, [products, filterText, activeCategory]);

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
      variantId: sp.variant.id,
      variantName: sp.variant.name,
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

      {/* Category pills */}
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
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              {item.product.foodType && (
                <View style={[styles.foodTypeDot, item.product.foodType === "VEG" || item.product.foodType === "VEGAN" ? styles.foodTypeVeg : styles.foodTypeNonVeg]}>
                  <View style={[styles.foodTypeDotInner, item.product.foodType === "VEG" || item.product.foodType === "VEGAN" ? styles.foodTypeDotVeg : styles.foodTypeDotNonVeg]} />
                </View>
              )}
              {item.product.brand && (
                <Text style={styles.brandName}>{item.product.brand}</Text>
              )}
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.productName}>{item.product.name}</Text>
              <View style={styles.priceGroup}>
                {item.variant.mrp != null && Number(item.variant.mrp) > Number(item.price) && (
                  <Text style={styles.mrpPrice}>₹{Number(item.variant.mrp).toFixed(2)}</Text>
                )}
                <Text style={styles.price}>₹{Number(item.price).toFixed(2)}</Text>
              </View>
            </View>
            <Text style={styles.variantInfo}>
              {item.variant.name} · {item.variant.unitType} {item.variant.unitValue}
            </Text>
            {item.product.description && (
              <Text style={styles.description}>{item.product.description}</Text>
            )}
            {item.product.regulatoryMarks?.length > 0 && (
              <View style={styles.badgeRow}>
                {item.product.regulatoryMarks.map((mark: string) => (
                  <View key={mark} style={styles.regBadge}>
                    <Text style={styles.regBadgeText}>{mark}</Text>
                  </View>
                ))}
              </View>
            )}
            {item.product.certifications?.length > 0 && (
              <View style={styles.badgeRow}>
                {item.product.certifications.map((cert: string) => (
                  <View key={cert} style={styles.certBadge}>
                    <Text style={styles.certBadgeText}>{cert}</Text>
                  </View>
                ))}
              </View>
            )}
            {item.product.dangerWarnings && (
              <View style={styles.dangerBanner}>
                <Text style={styles.dangerBannerText}>{item.product.dangerWarnings}</Text>
              </View>
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
  list: { paddingHorizontal: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  foodTypeDot: {
    width: 16, height: 16, borderWidth: 1.5, borderRadius: 3,
    justifyContent: "center", alignItems: "center",
  },
  foodTypeVeg: { borderColor: "#0a8f08" },
  foodTypeNonVeg: { borderColor: "#b71c1c" },
  foodTypeDotInner: { width: 8, height: 8, borderRadius: 4 },
  foodTypeDotVeg: { backgroundColor: "#0a8f08" },
  foodTypeDotNonVeg: { backgroundColor: "#b71c1c" },
  brandName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase" },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  productName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text, flex: 1 },
  priceGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  mrpPrice: { fontSize: fontSize.sm, color: colors.textSecondary, textDecorationLine: "line-through" },
  price: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.primary },
  variantInfo: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  description: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: spacing.xs },
  regBadge: {
    backgroundColor: "#e6f0ff", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  regBadgeText: { fontSize: fontSize.xs, color: "#1a56db", fontWeight: "600" },
  certBadge: {
    backgroundColor: "#e6f9e6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  certBadgeText: { fontSize: fontSize.xs, color: "#166534", fontWeight: "600" },
  dangerBanner: {
    backgroundColor: "#fef3c7", borderRadius: 4, padding: spacing.xs, marginTop: spacing.xs,
    borderWidth: 1, borderColor: "#f59e0b",
  },
  dangerBannerText: { fontSize: fontSize.xs, color: "#92400e" },
  addButton: {
    backgroundColor: colors.primary, borderRadius: 6, paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md, alignSelf: "flex-end", marginTop: spacing.sm,
  },
  addedButton: { backgroundColor: colors.success },
  addButtonText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600" },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: spacing.xl },
});
