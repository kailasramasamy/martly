import { useEffect, useState, useRef, useCallback } from "react";
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
import { useLanguage } from "../lib/language-context";
import { colors, spacing, fontSize } from "../constants/theme";
import { GRID_H_PADDING } from "../components/FeaturedProductCard";
import { ProductList } from "../components/ProductList";
import { ProductActionsProvider } from "../lib/product-actions";
import { FloatingCart } from "../components/FloatingCart";
import { ProductCardSkeleton } from "../components/SkeletonLoader";
import type { StoreProduct, DepartmentNode } from "../lib/types";

// Unified tree node for recursive search
interface TreeNode {
  id: string;
  name: string;
  translations?: Record<string, { name?: string; description?: string }> | null;
  children: TreeNode[];
}

function toTreeNodes(departments: DepartmentNode[]): TreeNode[] {
  return departments.map((d) => ({
    id: d.id, name: d.name, translations: d.translations,
    children: d.categories.map((c) => ({
      id: c.id, name: c.name, translations: c.translations,
      children: c.subcategories.map((s) => ({
        id: s.id, name: s.name, translations: s.translations,
        children: [],
      })),
    })),
  }));
}

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
  const { getLocalizedName } = useLanguage();

  const [query, setQuery] = useState(initialQuery ?? "");
  const [categories, setCategories] = useState<TreeNode[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(initialCategoryId ?? null);
  const [activeFoodType, setActiveFoodType] = useState<string | null>(null);
  const [results, setResults] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const searchRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [searchMeta, setSearchMeta] = useState<{
    strategy: string;
    correctedQuery?: string;
    expandedTerms?: string[];
  } | null>(null);

  const navigation = useNavigation();

  // Fetch categories for filter chips
  useEffect(() => {
    api
      .get<DepartmentNode[]>("/api/v1/categories/tree")
      .then((res) => setCategories(toTreeNodes(res.data)))
      .catch(() => {});
  }, []);

  // Update screen title based on active category or filter
  useEffect(() => {
    if (hasDiscount === "true") {
      navigation.setOptions({ title: "Today's Deals" });
    } else if (sortBy === "newest") {
      navigation.setOptions({ title: "New Arrivals" });
    } else if (activeCategoryId && categories.length > 0) {
      const findCat = (nodes: TreeNode[]): TreeNode | null => {
        for (const n of nodes) {
          if (n.id === activeCategoryId) return n;
          const found = findCat(n.children);
          if (found) return found;
        }
        return null;
      };
      const cat = findCat(categories);
      const name = cat ? getLocalizedName(cat) : null;
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




  return (
    <ProductActionsProvider store={selectedStore ?? null}>
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
              ...categories.map((c) => ({ id: c.id, label: getLocalizedName(c), type: "category" as const })),
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
        {searchMeta && searchMeta.strategy !== "keyword" && results.length > 0 && (
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
        <ProductList
          products={results}
          layout="grid"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.grid}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          keyboardShouldPersistTaps="handled"
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
      </View>
    </ProductActionsProvider>
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
