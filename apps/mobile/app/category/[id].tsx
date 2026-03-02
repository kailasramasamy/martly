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
import { useCart } from "../../lib/cart-context";
import { useWishlist } from "../../lib/wishlist-context";
import { useMembership, getBestPrice } from "../../lib/membership-context";
import { colors, spacing } from "../../constants/theme";
import { getCategoryIcon } from "../../constants/category-icons";
import { ProductGridCard, GRID_GAP, GRID_H_PADDING } from "../../components/ProductGridCard";
import { VariantBottomSheet } from "../../components/VariantBottomSheet";
import { FloatingCart } from "../../components/FloatingCart";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import type { StoreProduct, CategoryTreeNode, Banner } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = Math.round(SCREEN_WIDTH * 0.22);

interface SubcategoryWithCount {
  id: string;
  name: string;
  imageUrl: string | null;
  count: number;
}

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { selectedStore } = useStore();
  const { storeId: cartStoreId, items: cartItems, addItem, updateQuantity } = useCart();
  const { isWishlisted, toggle: toggleWishlist } = useWishlist();
  const { isMember } = useMembership();

  const [category, setCategory] = useState<CategoryTreeNode | null>(null);
  const [allProducts, setAllProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetVariants, setSheetVariants] = useState<StoreProduct[]>([]);
  const [replaceCartConfirm, setReplaceCartConfirm] = useState<{ pending: () => void } | null>(null);
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
      .get<CategoryTreeNode[]>("/api/v1/categories/tree")
      .then((res) => {
        const findNode = (nodes: CategoryTreeNode[]): CategoryTreeNode | null => {
          for (const n of nodes) {
            if (n.id === id) return n;
            const found = findNode(n.children);
            if (found) return found;
          }
          return null;
        };
        const node = findNode(res.data);
        if (node) {
          setCategory(node);
          navigation.setOptions({ title: node.name });
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

  // Fetch CATEGORY_TOP banners for this category
  useEffect(() => {
    if (!selectedStore || !id) return;
    api
      .get<Banner[]>(`/api/v1/banners/by-placement/${selectedStore.id}?placement=CATEGORY_TOP&categoryId=${id}`)
      .then((res) => setTopBanners(res.data))
      .catch(() => {});
  }, [selectedStore, id]);

  // Build subcategory list with product counts
  const subcategories = useMemo((): SubcategoryWithCount[] => {
    if (!category?.children?.length) return [];

    // Collect all descendant IDs per direct child
    const childDescendants = new Map<string, Set<string>>();
    const allChildren = category.children;

    for (const child of allChildren) {
      const ids = new Set<string>([child.id]);
      // Add grandchildren etc.
      const collectDescendants = (node: CategoryTreeNode) => {
        for (const c of node.children ?? []) {
          ids.add(c.id);
          collectDescendants(c);
        }
      };
      collectDescendants(child);
      childDescendants.set(child.id, ids);
    }

    return allChildren.map((child) => {
      const descIds = childDescendants.get(child.id)!;
      const count = allProducts.filter(
        (p) => p.product?.category?.id && descIds.has(p.product.category.id)
      ).length;
      return { id: child.id, name: child.name, imageUrl: child.imageUrl ?? null, count };
    });
  }, [category, allProducts]);

  // Build grandchild list (children of the active subcategory) with product counts
  const grandchildren = useMemo((): SubcategoryWithCount[] => {
    if (!activeSub || !category?.children?.length) return [];
    const sub = category.children.find((c) => c.id === activeSub);
    if (!sub?.children?.length) return [];

    return sub.children.map((gc) => {
      const ids = new Set<string>([gc.id]);
      const collectDesc = (node: CategoryTreeNode) => {
        for (const c of node.children ?? []) {
          ids.add(c.id);
          collectDesc(c);
        }
      };
      collectDesc(gc);
      const count = allProducts.filter(
        (p) => p.product?.category?.id && ids.has(p.product.category.id)
      ).length;
      return { id: gc.id, name: gc.name, count };
    });
  }, [activeSub, category, allProducts]);

  // Filter products by selected subcategory (and grandchild if active)
  const filteredProducts = useMemo(() => {
    if (!activeSub) return allProducts;
    const sub = category?.children?.find((c) => c.id === activeSub);
    if (!sub) return allProducts;

    // If a grandchild is selected, narrow to that grandchild + its descendants
    const targetNode = activeGrandchild
      ? sub.children?.find((c) => c.id === activeGrandchild) ?? sub
      : sub;

    const ids = new Set<string>([targetNode.id]);
    const collect = (node: CategoryTreeNode) => {
      for (const c of node.children ?? []) {
        ids.add(c.id);
        collect(c);
      }
    };
    collect(targetNode);
    return allProducts.filter(
      (p) => p.product?.category?.id && ids.has(p.product.category.id)
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

  // Group by product ID — pick cheapest variant as primary
  const { groupedResults, variantsByProductId } = useMemo(() => {
    const groups = new Map<string, StoreProduct[]>();
    for (const sp of chipFilteredProducts) {
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

    if (sortBy) {
      primary.sort((a, b) => {
        const priceA = a.pricing?.discountActive ? a.pricing.effectivePrice : Number(a.price);
        const priceB = b.pricing?.discountActive ? b.pricing.effectivePrice : Number(b.price);
        return sortBy === "price_asc" ? priceA - priceB : priceB - priceA;
      });
    }

    return { groupedResults: primary, variantsByProductId: variantsMap };
  }, [chipFilteredProducts, sortBy]);

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
      const item = {
        storeProductId: sp.id,
        productId: sp.product.id,
        productName: sp.product.name,
        variantId: sp.variant.id,
        variantName: sp.variant.name,
        price: getBestPrice(sp, isMember),
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
    [selectedStore, cartStoreId, addItem, isMember]
  );

  const handleShowVariants = useCallback(
    (productId: string) => {
      const variants = variantsByProductId.get(productId);
      if (variants) {
        setSheetVariants(variants);
        setSheetVisible(true);
      }
    },
    [variantsByProductId]
  );

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
  const totalCount = allProducts.length;
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
                {gc.name}
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

    if (groupedResults.length === 0) {
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
      <FlatList
        ref={gridRef}
        data={groupedResults}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={[
          styles.grid,
          narrow && styles.gridNarrow,
        ]}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => {
          const variants = variantsByProductId.get(item.product.id);
          const sizes = variants && variants.length > 1
            ? variants.map((v) => v.variant.name)
            : undefined;
          const totalQty = variants
            ? variants.reduce((sum, v) => sum + (cartQuantityMap.get(v.id) ?? 0), 0)
            : cartQuantityMap.get(item.id) ?? 0;
          return (
            <ProductGridCard
              item={item}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={updateQuantity}
              quantity={totalQty}
              storeId={selectedStore?.id}
              variantCount={variants?.length ?? 1}
              onShowVariants={() => handleShowVariants(item.product.id)}
              containerWidth={narrow && contentWidth > 0 ? contentWidth - 20 : undefined}
              variantSizes={sizes}
              isWishlisted={isWishlisted(item.product.id)}
              onToggleWishlist={toggleWishlist}
              isMember={isMember}
            />
          );
        }}
      />
    );
  };

  return (
    <View style={styles.container}>
      {hasSidebar ? (
        <View style={styles.splitLayout}>
          {/* Left sidebar */}
          <ScrollView
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
                  size={20}
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
                        size={20}
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
                    {sub.name}
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
      <VariantBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        variants={sheetVariants}
        onAddToCart={handleAddToCart}
        onUpdateQuantity={updateQuantity}
        cartQuantityMap={cartQuantityMap}
        isMember={isMember}
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
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
    backgroundColor: "#f1f5f9",
  },
  sidebarItemActive: {
    backgroundColor: "#fff",
    borderLeftColor: colors.primary,
  },
  sidebarIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  sidebarIconCircleActive: {
    backgroundColor: colors.primary + "15",
  },
  sidebarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  sidebarLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 14,
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
  gridRow: {
    justifyContent: "space-between",
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
