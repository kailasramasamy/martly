import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useNavigation, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useStore } from "../../lib/store-context";
import { useLanguage } from "../../lib/language-context";
import { ProductActionsProvider } from "../../lib/product-actions";
import { colors, spacing } from "../../constants/theme";
import { getCategoryIcon } from "../../constants/category-icons";
import { GRID_GAP, GRID_H_PADDING, GRID_CARD_WIDTH } from "../../components/FeaturedProductCard";
import { ProductList } from "../../components/ProductList";
import { FloatingCart } from "../../components/FloatingCart";
import type { StoreProduct, DepartmentNode, Banner } from "../../lib/types";

// Unified tree node for recursive category browsing
interface TreeNode {
  id: string;
  name: string;
  imageUrl?: string | null;
  translations?: Record<string, { name?: string; description?: string }> | null;
  children: TreeNode[];
}

function toTreeNodes(departments: DepartmentNode[]): TreeNode[] {
  return departments.map((d) => ({
    id: d.id, name: d.name, imageUrl: d.imageUrl, translations: d.translations,
    children: d.categories.map((c) => ({
      id: c.id, name: c.name, imageUrl: c.imageUrl, translations: c.translations,
      children: c.subcategories.map((s) => ({
        id: s.id, name: s.name, imageUrl: s.imageUrl, translations: s.translations,
        children: [],
      })),
    })),
  }));
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = Math.round(SCREEN_WIDTH * 0.21);

interface SubcategoryWithCount {
  id: string;
  name: string;
  imageUrl: string | null;
  count: number;
  translations?: Record<string, { name?: string; description?: string }> | null;
}

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { selectedStore } = useStore();
  const { getLocalizedName } = useLanguage();

  const [category, setCategory] = useState<TreeNode | null>(null);
  const [allProducts, setAllProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [filterOnSale, setFilterOnSale] = useState(false);
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | null>(null);
  const [activeGrandchild, setActiveGrandchild] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [topBanners, setTopBanners] = useState<Banner[]>([]);

  const gridRef = useRef<FlatList>(null);

  // Fetch full category tree and find our category node (gives recursive children)
  useEffect(() => {
    if (!id) return;
    api
      .get<DepartmentNode[]>("/api/v1/categories/tree")
      .then((res) => {
        const tree = toTreeNodes(res.data);
        const findNode = (nodes: TreeNode[]): TreeNode | null => {
          for (const n of nodes) {
            if (n.id === id) return n;
            const found = findNode(n.children);
            if (found) return found;
          }
          return null;
        };
        const node = findNode(tree);
        if (node) {
          setCategory(node);
          navigation.setOptions({ title: getLocalizedName(node) });
        }
      })
      .catch(() => {});
  }, [id, navigation]);

  // Fetch all products for this parent category (includes descendants)
  useEffect(() => {
    if (!id || !selectedStore) return;
    setLoading(true);
    api
      .getList<StoreProduct>(
        `/api/v1/stores/${selectedStore.id}/products?categoryId=${id}&pageSize=200`
      )
      .then((res) => setAllProducts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, selectedStore]);

  // Fetch CATEGORY_TOP banners — detect level from tree to send correct param
  useEffect(() => {
    if (!selectedStore || !id || !category) return;
    // Determine which level this node is at by checking the tree
    const isTopLevel = category.children.some((c) => c.children.length > 0);
    const param = isTopLevel ? "departmentId" : category.children.length > 0 ? "categoryId" : "subcategoryId";
    api
      .get<Banner[]>(`/api/v1/banners/by-placement/${selectedStore.id}?placement=CATEGORY_TOP&${param}=${id}`)
      .then((res) => setTopBanners(res.data))
      .catch(() => {});
  }, [selectedStore, id, category]);

  // Build subcategory list with product counts
  const subcategories = useMemo((): SubcategoryWithCount[] => {
    if (!category?.children?.length) return [];

    // Collect all descendant IDs per direct child
    const childDescendants = new Map<string, Set<string>>();
    const allChildren = category.children;

    for (const child of allChildren) {
      const ids = new Set<string>([child.id]);
      // Add grandchildren etc.
      const collectDescendants = (node: TreeNode) => {
        for (const c of node.children ?? []) {
          ids.add(c.id);
          collectDescendants(c);
        }
      };
      collectDescendants(child);
      childDescendants.set(child.id, ids);
    }

    // Collect all descendant category IDs across all children
    const allDescIds = new Set<string>();
    for (const ids of childDescendants.values()) {
      for (const cid of ids) allDescIds.add(cid);
    }

    const result = allChildren.map((child) => {
      const descIds = childDescendants.get(child.id)!;
      const uniqueProducts = new Set(
        allProducts
          .filter((p) => p.product?.subcategory?.id && descIds.has(p.product.subcategory?.id))
          .map((p) => p.product.id)
      );
      return { id: child.id, name: child.name, imageUrl: child.imageUrl ?? null, count: uniqueProducts.size, translations: child.translations };
    });

    // Add "Other" for products not in any subcategory (e.g. assigned to parent category directly)
    const otherCount = new Set(
      allProducts
        .filter((p) => !p.product?.subcategory?.id || !allDescIds.has(p.product.subcategory?.id))
        .map((p) => p.product.id)
    ).size;
    if (otherCount > 0) {
      result.push({ id: "__other__", name: "Other", imageUrl: null, count: otherCount });
    }

    return result;
  }, [category, allProducts]);

  // Build grandchild list (children of the active subcategory) with product counts
  const grandchildren = useMemo((): SubcategoryWithCount[] => {
    if (!activeSub || !category?.children?.length) return [];
    const sub = category.children.find((c) => c.id === activeSub);
    if (!sub?.children?.length) return [];

    return sub.children.map((gc) => {
      const ids = new Set<string>([gc.id]);
      const collectDesc = (node: TreeNode) => {
        for (const c of node.children ?? []) {
          ids.add(c.id);
          collectDesc(c);
        }
      };
      collectDesc(gc);
      const uniqueProducts = new Set(
        allProducts
          .filter((p) => p.product?.subcategory?.id && ids.has(p.product.subcategory?.id))
          .map((p) => p.product.id)
      );
      return { id: gc.id, name: gc.name, count: uniqueProducts.size, translations: gc.translations };
    });
  }, [activeSub, category, allProducts]);

  // Filter products by selected subcategory (and grandchild if active)
  const filteredProducts = useMemo(() => {
    if (!activeSub) return allProducts;

    // "Other" — products not in any real subcategory
    if (activeSub === "__other__") {
      const allDescIds = new Set<string>();
      for (const child of category?.children ?? []) {
        const collect = (node: TreeNode) => {
          allDescIds.add(node.id);
          for (const c of node.children ?? []) collect(c);
        };
        collect(child);
      }
      return allProducts.filter((p) => !p.product?.subcategory?.id || !allDescIds.has(p.product.subcategory?.id));
    }

    const sub = category?.children?.find((c) => c.id === activeSub);
    if (!sub) return allProducts;

    // If a grandchild is selected, narrow to that grandchild + its descendants
    const targetNode = activeGrandchild
      ? sub.children?.find((c) => c.id === activeGrandchild) ?? sub
      : sub;

    const ids = new Set<string>([targetNode.id]);
    const collect = (node: TreeNode) => {
      for (const c of node.children ?? []) {
        ids.add(c.id);
        collect(c);
      }
    };
    collect(targetNode);
    return allProducts.filter(
      (p) => p.product?.subcategory?.id && ids.has(p.product.subcategory?.id)
    );
  }, [allProducts, activeSub, activeGrandchild, category]);

  // Apply chip filters (food type, on sale) and search
  const chipFilteredProducts = useMemo(() => {
    let result = filteredProducts;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => {
        const name = p.product?.name?.toLowerCase() ?? "";
        const brand = p.product?.brand?.name?.toLowerCase() ?? "";
        return name.includes(q) || brand.includes(q);
      });
    }

    if (filterOnSale) {
      result = result.filter((p) => p.pricing?.discountActive === true);
    }

    return result;
  }, [filteredProducts, searchQuery, filterOnSale]);

  const handleSubcategoryPress = useCallback(
    (subId: string | null) => {
      setActiveSub((prev) => (prev === subId ? null : subId));
      setActiveGrandchild(null);
      gridRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    []
  );

  // Scroll to top when filters change
  useEffect(() => {
    gridRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [filterOnSale, sortBy, activeGrandchild]);

  const handleBannerPress = useCallback((banner: Banner) => {
    switch (banner.actionType) {
      case "CATEGORY":
        if (banner.actionTarget) router.push({ pathname: "/category/[id]", params: { id: banner.actionTarget } });
        break;
      case "PRODUCT":
        if (banner.actionTarget) router.push({ pathname: "/product/[id]", params: { id: banner.actionTarget } });
        break;
      case "COLLECTION":
        if (banner.actionTarget) router.push({ pathname: "/search", params: { collectionId: banner.actionTarget } } as any);
        break;
      case "SEARCH":
        if (banner.actionTarget) router.push({ pathname: "/search", params: { q: banner.actionTarget } } as any);
        break;
    }
  }, []);

  const hasActiveFilters = filterOnSale || sortBy !== null || activeGrandchild !== null || searchQuery.trim().length > 0;
  const totalCount = useMemo(() => new Set(allProducts.map((p) => p.product.id)).size, [allProducts]);
  const hasSidebar = subcategories.length > 0;

  const renderTopBanner = () => {
    if (topBanners.length === 0) return null;
    const banner = topBanners[0];
    return (
      <TouchableOpacity
        activeOpacity={banner.actionType === "NONE" ? 1 : 0.9}
        onPress={() => handleBannerPress(banner)}
        style={styles.topBanner}
      >
        <Image source={{ uri: banner.imageUrl }} style={styles.topBannerImage} resizeMode="cover" />
        <View style={styles.topBannerOverlay}>
          <Text style={styles.topBannerTitle} numberOfLines={1}>{banner.title}</Text>
          {banner.subtitle && (
            <Text style={styles.topBannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchBox = () => (
    <View style={styles.searchContainer}>
      <Ionicons name="search" size={16} color="#94a3b8" style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search products..."
        placeholderTextColor="#94a3b8"
        value={searchQuery}
        onChangeText={setSearchQuery}
        returnKeyType="search"
        autoCorrect={false}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
          <Ionicons name="close-circle" size={18} color="#94a3b8" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderGrandchildPills = () => {
    if (grandchildren.length === 0) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={styles.pillBar}
      >
        <TouchableOpacity
          style={[styles.pill, !activeGrandchild && styles.pillActive]}
          onPress={() => {
            setActiveGrandchild(null);
            gridRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.pillText, !activeGrandchild && styles.pillTextActive]}
          >
            All
          </Text>
        </TouchableOpacity>

        {grandchildren.map((gc) => {
          const isActive = activeGrandchild === gc.id;
          return (
            <TouchableOpacity
              key={gc.id}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => {
                setActiveGrandchild((prev) => (prev === gc.id ? null : gc.id));
                gridRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {getLocalizedName(gc)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderFilterChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroll}
      contentContainerStyle={styles.chipBar}
    >
      <TouchableOpacity
        style={[styles.chip, filterOnSale && styles.chipActive]}
        onPress={() => setFilterOnSale((v) => !v)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="pricetag"
          size={13}
          color={filterOnSale ? "#fff" : "#64748b"}
        />
        <Text style={[styles.chipText, filterOnSale && styles.chipTextActive]}>
          On Sale
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.chip, sortBy === "price_asc" && styles.chipActive]}
        onPress={() =>
          setSortBy((v) => (v === "price_asc" ? null : "price_asc"))
        }
        activeOpacity={0.7}
      >
        <Ionicons
          name="arrow-up"
          size={13}
          color={sortBy === "price_asc" ? "#fff" : "#64748b"}
        />
        <Text
          style={[
            styles.chipText,
            sortBy === "price_asc" && styles.chipTextActive,
          ]}
        >
          Price ↑
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.chip, sortBy === "price_desc" && styles.chipActive]}
        onPress={() =>
          setSortBy((v) => (v === "price_desc" ? null : "price_desc"))
        }
        activeOpacity={0.7}
      >
        <Ionicons
          name="arrow-down"
          size={13}
          color={sortBy === "price_desc" ? "#fff" : "#64748b"}
        />
        <Text
          style={[
            styles.chipText,
            sortBy === "price_desc" && styles.chipTextActive,
          ]}
        >
          Price ↓
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderProductGrid = (narrow: boolean) => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (chipFilteredProducts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search-outline" size={32} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptySubtitle}>
            {hasActiveFilters
              ? "Try adjusting your filters"
              : activeSub
                ? "Try selecting a different subcategory"
                : "No products available in this category yet"}
          </Text>
        </View>
      );
    }

    return (
      <ProductList
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ref={gridRef}
        products={chipFilteredProducts}
        layout="grid"
        sortBy={sortBy ?? undefined}
        cardWidth={narrow && contentWidth > 0 ? (contentWidth - 20 - GRID_GAP) / 2 : GRID_CARD_WIDTH}
        contentContainerStyle={[
          styles.grid,
          narrow && styles.gridNarrow,
        ]}
      />
    );
  };

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={styles.container}>
        {hasSidebar ? (
          <View style={styles.splitLayout}>
            {/* Left sidebar */}
            <ScrollView
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              style={styles.sidebar}
              showsVerticalScrollIndicator={false}
            >
              {/* All item */}
              <TouchableOpacity
                style={[
                  styles.sidebarItem,
                  !activeSub && styles.sidebarItemActive,
                ]}
                onPress={() => handleSubcategoryPress(null)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.sidebarIconCircle,
                  !activeSub && styles.sidebarIconCircleActive,
                ]}>
                  <Ionicons
                    name="grid-outline"
                    size={24}
                    color={!activeSub ? colors.primary : "#94a3b8"}
                  />
                </View>
                <Text
                  style={[
                    styles.sidebarLabel,
                    !activeSub && styles.sidebarLabelActive,
                  ]}
                  numberOfLines={2}
                >
                  All
                </Text>
                <Text
                  style={[
                    styles.sidebarCount,
                    !activeSub && styles.sidebarCountActive,
                  ]}
                >
                  {totalCount}
                </Text>
              </TouchableOpacity>

              {subcategories.map((sub) => {
                const isActive = activeSub === sub.id;
                const icon = getCategoryIcon(sub.name);
                return (
                  <TouchableOpacity
                    key={sub.id}
                    style={[
                      styles.sidebarItem,
                      isActive && styles.sidebarItemActive,
                    ]}
                    onPress={() => handleSubcategoryPress(sub.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.sidebarIconCircle,
                      isActive && styles.sidebarIconCircleActive,
                    ]}>
                      {sub.imageUrl ? (
                        <Image source={{ uri: sub.imageUrl }} style={styles.sidebarImage} resizeMode="contain" />
                      ) : (
                        <Ionicons
                          name={icon}
                          size={24}
                          color={isActive ? colors.primary : "#94a3b8"}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.sidebarLabel,
                        isActive && styles.sidebarLabelActive,
                      ]}
                      numberOfLines={2}
                    >
                      {getLocalizedName(sub)}
                    </Text>
                    <Text
                      style={[
                        styles.sidebarCount,
                        isActive && styles.sidebarCountActive,
                      ]}
                    >
                      {sub.count}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Right content */}
            <View
              style={styles.contentArea}
              onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
            >
              {renderTopBanner()}
              {renderSearchBox()}
              {renderGrandchildPills()}
              {renderFilterChips()}
              {renderProductGrid(true)}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {renderTopBanner()}
            {renderSearchBox()}
            {renderGrandchildPills()}
            {renderFilterChips()}
            {renderProductGrid(false)}
          </View>
        )}

        <FloatingCart />
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  splitLayout: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: "#f1f5f9",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  sidebarItem: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRightWidth: 3,
    borderRightColor: "transparent",
    backgroundColor: "#f1f5f9",
  },
  // Indicator on the right edge, next to the product grid it controls
  sidebarItemActive: {
    backgroundColor: "#fff",
    borderRightColor: colors.primary,
  },
  sidebarIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  sidebarIconCircleActive: {
    borderColor: colors.primary,
  },
  // Product-photo thumbnails: show the whole pack and blend its white background into the tile
  sidebarImage: {
    width: 40,
    height: 40,
    mixBlendMode: "multiply",
  },
  sidebarLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 13,
  },
  sidebarLabelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  sidebarCount: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
  },
  sidebarCountActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  contentArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    marginTop: 8,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },
  pillScroll: {
    minHeight: 44,
    flexGrow: 0,
  },
  pillBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  pill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: "#fff",
  },
  chipScroll: {
    minHeight: 40,
    flexGrow: 0,
  },
  chipBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    height: 30,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  chipTextActive: {
    color: "#fff",
  },
  grid: {
    paddingHorizontal: GRID_H_PADDING,
    paddingTop: 12,
    paddingBottom: spacing.xl,
  },
  gridNarrow: {
    paddingHorizontal: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  topBanner: {
    marginHorizontal: 10,
    marginTop: 8,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
  },
  topBannerImage: {
    width: "100%",
    height: "100%",
  },
  topBannerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  topBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  topBannerSubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    marginTop: 1,
  },
});
