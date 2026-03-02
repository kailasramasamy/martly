import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { useCart } from "../lib/cart-context";
import { useWishlist } from "../lib/wishlist-context";
import { colors, spacing, fontSize } from "../constants/theme";
import { ProductGridCard, GRID_GAP, GRID_H_PADDING } from "../components/ProductGridCard";
import { VariantBottomSheet } from "../components/VariantBottomSheet";
import { FloatingCart } from "../components/FloatingCart";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { ProductCardSkeleton } from "../components/SkeletonLoader";
import type { StoreProduct, CategoryTreeNode } from "../lib/types";

const FOOD_TYPES = [
  { id: "VEG", label: "Veg" },
  { id: "NON_VEG", label: "Non-Veg" },
  { id: "VEGAN", label: "Vegan" },
];

export default function SearchScreen() {
  const { categoryId: initialCategoryId, hasDiscount, sortBy, q: initialQuery } = useLocalSearchParams<{
    categoryId?: string;
    hasDiscount?: string;
    sortBy?: string;
    q?: string;
  }>();
  const { selectedStore } = useStore();
  const { storeId: cartStoreId, items: cartItems, addItem, updateQuantity } = useCart();
  const { isWishlisted, toggle: toggleWishlist } = useWishlist();

  const [query, setQuery] = useState(initialQuery ?? "");
  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(initialCategoryId ?? null);
  const [activeFoodType, setActiveFoodType] = useState<string | null>(null);
  const [results, setResults] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const searchRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetVariants, setSheetVariants] = useState<StoreProduct[]>([]);
  const [replaceCartConfirm, setReplaceCartConfirm] = useState<{ pending: () => void } | null>(null);
  const [searchMeta, setSearchMeta] = useState<{
    strategy: string;
    correctedQuery?: string;
    expandedTerms?: string[];
  } | null>(null);

  const navigation = useNavigation();

  // Fetch categories for filter chips
  useEffect(() => {
    api
      .get<CategoryTreeNode[]>("/api/v1/categories/tree")
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  // Update screen title based on active category or filter
  useEffect(() => {
    if (hasDiscount === "true") {
      navigation.setOptions({ title: "Today's Deals" });
    } else if (sortBy === "newest") {
      navigation.setOptions({ title: "New Arrivals" });
    } else if (activeCategoryId && categories.length > 0) {
      const findCat = (nodes: CategoryTreeNode[]): string | null => {
        for (const n of nodes) {
          if (n.id === activeCategoryId) return n.name;
          const found = findCat(n.children);
          if (found) return found;
        }
        return null;
      };
      const name = findCat(categories);
      navigation.setOptions({ title: name ?? "Products" });
    } else {
      navigation.setOptions({ title: "Search" });
    }
  }, [activeCategoryId, categories, navigation, hasDiscount, sortBy]);

  // Auto-focus search input
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 300);
  }, []);

  // Search function
  const doSearch = useCallback(
    (q: string, catId: string | null, foodType: string | null, pageNum: number) => {
      setLoading(true);

      let path: string;
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("pageSize", "20");
      if (q) params.set("q", q);
      if (catId) params.set("categoryId", catId);
      if (foodType) params.set("foodType", foodType);
      if (hasDiscount === "true") params.set("hasDiscount", "true");
      if (sortBy) params.set("sortBy", sortBy);

      if (selectedStore) {
        path = `/api/v1/stores/${selectedStore.id}/products?${params.toString()}`;
      } else {
        path = `/api/v1/products?${params.toString()}`;
      }

      api
        .getList<StoreProduct>(path)
        .then((res) => {
          if (pageNum === 1) {
            setResults(res.data);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const meta = (res as any).searchMeta;
            setSearchMeta(meta ?? null);
          } else {
            setResults((prev) => [...prev, ...res.data]);
          }
          setHasMore(res.data.length === 20);
        })
        .catch(() => {
          if (pageNum === 1) {
            setResults([]);
            setSearchMeta(null);
          }
        })
        .finally(() => setLoading(false));
    },
    [selectedStore],
  );

  // Trigger search on filter changes
  useEffect(() => {
    setPage(1);
    doSearch(query, activeCategoryId, activeFoodType, 1);
  }, [activeCategoryId, activeFoodType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger initial search if category, discount filter, or sort was passed
  useEffect(() => {
    if (initialCategoryId || hasDiscount || sortBy || initialQuery) {
      doSearch(query, activeCategoryId, activeFoodType, 1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQueryChange = (text: string) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      doSearch(text, activeCategoryId, activeFoodType, 1);
    }, 300);
  };

  const handleLoadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    doSearch(query, activeCategoryId, activeFoodType, nextPage);
  };

  const toggleCategory = (id: string) => {
    setActiveCategoryId((prev) => (prev === id ? null : id));
  };

  const toggleFoodType = (id: string) => {
    setActiveFoodType((prev) => (prev === id ? null : id));
  };

  // Group results by product.id — pick cheapest as primary, store all variants
  const { groupedResults, variantsByProductId } = useMemo(() => {
    const groups = new Map<string, StoreProduct[]>();
    for (const sp of results) {
      if (!sp.product) continue;
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

    return { groupedResults: primary, variantsByProductId: variantsMap };
  }, [results]);

  const handleShowVariants = useCallback(
    (productId: string) => {
      const variants = variantsByProductId.get(productId);
      if (variants) {
        setSheetVariants(variants);
        setSheetVisible(true);
      }
    },
    [variantsByProductId],
  );

  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      map.set(item.storeProductId, item.quantity);
    }
    return map;
  }, [cartItems]);

  const handleAddToCart = useCallback(
    (sp: StoreProduct) => {
      if (!selectedStore) return;

      const effectivePrice = sp.pricing?.discountActive
        ? sp.pricing.effectivePrice
        : Number(sp.price);

      const item = {
        storeProductId: sp.id,
        productId: sp.product.id,
        productName: sp.product.name,
        variantId: sp.variant.id,
        variantName: sp.variant.name,
        price: effectivePrice,
        imageUrl: sp.product.imageUrl ?? sp.variant.imageUrl,
      };

      if (cartStoreId && cartStoreId !== selectedStore.id) {
        setReplaceCartConfirm({
          pending: () => addItem(selectedStore.id, selectedStore.name, item),
        });
        return;
      }

      addItem(selectedStore.id, selectedStore.name, item);
    },
    [selectedStore, cartStoreId, addItem],
  );

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchRow}>
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          placeholder="Search products..."
          value={query}
          onChangeText={handleQueryChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            ...categories.map((c) => ({ id: c.id, label: c.name, type: "category" as const })),
            ...FOOD_TYPES.map((f) => ({ ...f, type: "food" as const })),
          ]}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => {
            const isActive =
              item.type === "category"
                ? activeCategoryId === item.id
                : activeFoodType === item.id;

            return (
              <TouchableOpacity
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() =>
                  item.type === "category" ? toggleCategory(item.id) : toggleFoodType(item.id)
                }
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Search Meta Banner */}
      {searchMeta && searchMeta.strategy !== "keyword" && groupedResults.length > 0 && (
        <View style={styles.searchMetaBanner}>
          <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
          <Text style={styles.searchMetaText}>
            Showing results for{" "}
            <Text style={styles.searchMetaBold}>
              {searchMeta.correctedQuery ?? searchMeta.expandedTerms?.join(", ") ?? "similar products"}
            </Text>
          </Text>
        </View>
      )}

      {/* Results */}
      <FlatList
        data={groupedResults}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const variants = variantsByProductId.get(item.product.id);
          return (
            <ProductGridCard
              item={item}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={updateQuantity}
              quantity={cartQuantityMap.get(item.id) ?? 0}
              storeId={selectedStore?.id}
              variantCount={variants?.length ?? 1}
              onShowVariants={() => handleShowVariants(item.product.id)}
              isWishlisted={isWishlisted(item.product.id)}
              onToggleWishlist={toggleWishlist}
            />
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View>
              {[1, 2, 3].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>
              {query || activeCategoryId || activeFoodType
                ? "No products found"
                : "Start typing to search"}
            </Text>
          )
        }
        ListFooterComponent={
          loading && results.length > 0 ? <ProductCardSkeleton /> : null
        }
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
      <ConfirmSheet
        visible={replaceCartConfirm !== null}
        title="Replace Cart?"
        message="Your cart has items from another store. Adding this item will replace your current cart."
        icon="cart-outline"
        iconColor="#f59e0b"
        confirmLabel="Replace"
        onConfirm={() => {
          replaceCartConfirm?.pending();
          setReplaceCartConfirm(null);
        }}
        onCancel={() => setReplaceCartConfirm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchRow: { padding: spacing.md, paddingBottom: 0 },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    letterSpacing: 0,
    backgroundColor: colors.surface,
  },
  filterSection: { marginTop: spacing.sm },
  chipRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.text },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  grid: { paddingHorizontal: GRID_H_PADDING, paddingBottom: spacing.xl },
  gridRow: { justifyContent: "space-between" },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: spacing.xl },
  searchMetaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: "#f0fdfa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccfbf1",
  },
  searchMetaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  searchMetaBold: {
    fontWeight: "600",
    color: colors.text,
  },
});
