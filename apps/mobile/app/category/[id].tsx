import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
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
import { GRID_GAP, GRID_H_PADDING, GRID_CARD_WIDTH } from "../../components/FeaturedProductCard";
import { ProductList } from "../../components/ProductList";
import { FloatingCart } from "../../components/FloatingCart";
import { HeroBannerSlide } from "../../components/HeroBannerSlide";
import { ShopByBrands } from "../../components/ShopByBrands";
import { CategorySidebar } from "../../components/CategorySidebar";
import { CategoryFilterBar, type PriceSort } from "../../components/CategoryFilterBar";
import { useCategoryFacets, useCategoryProducts } from "../../lib/use-category-browse";
import type { BrandTile } from "../../lib/brand-strip";
import type { DepartmentNode, Banner } from "../../lib/types";

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

interface SubcategoryWithCount {
  id: string;
  name: string;
  imageUrl: string | null;
  count: number;
  translations?: Record<string, { name?: string; description?: string }> | null;
}

// A node's own id plus every descendant id
function collectIds(node: TreeNode): Set<string> {
  const ids = new Set<string>([node.id]);
  const walk = (n: TreeNode) => n.children.forEach((c) => { ids.add(c.id); walk(c); });
  walk(node);
  return ids;
}

const EMPTY_SCOPE = new Set<string>();

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { selectedStore } = useStore();
  const { getLocalizedName } = useLanguage();

  const [category, setCategory] = useState<TreeNode | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [filterOnSale, setFilterOnSale] = useState(false);
  const [sortBy, setSortBy] = useState<PriceSort | null>(null);
  const [activeGrandchild, setActiveGrandchild] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [brandId, setBrandId] = useState<string | null>(null);
  const [topBanners, setTopBanners] = useState<Banner[]>([]);

  const gridRef = useRef<FlatList>(null);
  const storeId = selectedStore?.id;

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

  // Fetch CATEGORY_TOP banners — detect level from tree to send correct param
  useEffect(() => {
    if (!storeId || !id || !category) return;
    // Determine which level this node is at by checking the tree
    const isTopLevel = category.children.some((c) => c.children.length > 0);
    const param = isTopLevel ? "departmentId" : category.children.length > 0 ? "categoryId" : "subcategoryId";
    api
      .get<Banner[]>(`/api/v1/banners/by-placement/${storeId}?placement=CATEGORY_TOP&${param}=${id}`)
      .then((res) => setTopBanners(res.data))
      .catch(() => {});
  }, [storeId, id, category]);

  // Search as the user pauses typing, not on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const activeSubNode = category?.children.find((c) => c.id === activeSub) ?? null;
  const activeGrandchildNode = activeSubNode?.children.find((c) => c.id === activeGrandchild) ?? null;
  const selectedNode = activeGrandchildNode ?? activeSubNode ?? category;
  const selectedNodeId = selectedNode?.id ?? null;
  const scope = useMemo(() => (selectedNode ? collectIds(selectedNode) : EMPTY_SCOPE), [selectedNode]);

  // Counts for the sidebar and pills come from the whole page's node; brands follow the current selection
  const pageFacets = useCategoryFacets(storeId, id ?? null);
  const selectionFacets = useCategoryFacets(storeId, selectedNodeId !== id ? selectedNodeId : null);
  const nodeFacets = selectedNodeId === id ? pageFacets : selectionFacets;

  const { products, loading, loadingMore, loadMore } = useCategoryProducts({
    storeId, nodeId: selectedNodeId, onSale: filterOnSale, sortBy, brandId, query: debouncedQuery, scope,
  });

  const withCounts = useCallback(
    (nodes: TreeNode[]): SubcategoryWithCount[] =>
      nodes.map((n) => ({
        id: n.id, name: n.name, imageUrl: n.imageUrl ?? null, translations: n.translations,
        count: [...collectIds(n)].reduce((sum, sid) => sum + (pageFacets?.subcategoryCounts[sid] ?? 0), 0),
      })),
    [pageFacets],
  );
  const subcategories = useMemo(() => withCounts(category?.children ?? []), [category, withCounts]);
  const grandchildren = useMemo(() => withCounts(activeSubNode?.children ?? []), [activeSubNode, withCounts]);
  const brandTiles: BrandTile[] = nodeFacets?.brands ?? [];

  const scrollToTop = useCallback(() => gridRef.current?.scrollToOffset({ offset: 0, animated: true }), []);

  const handleSubcategoryPress = useCallback(
    (subId: string | null) => {
      setActiveSub((prev) => (prev === subId ? null : subId));
      setActiveGrandchild(null);
      setBrandId(null);
      scrollToTop();
    },
    [scrollToTop]
  );

  // Scroll to top when filters change
  useEffect(scrollToTop, [filterOnSale, sortBy, activeGrandchild, brandId]);

  useEffect(() => setBrandId(null), [activeGrandchild]);

  const handleBannerPress = useCallback((banner: Banner) => {
    switch (banner.actionType) {
      case "CATEGORY":
        if (banner.actionTarget) router.push({ pathname: "/category/[id]", params: { id: banner.actionTarget } });
        break;
      case "PRODUCT":
        if (banner.actionTarget) router.push({ pathname: "/product/[id]", params: { id: banner.actionTarget } });
        break;
      case "COLLECTION":
        if (banner.actionTarget) router.push({ pathname: "/collection/[id]", params: { id: banner.actionTarget } });
        break;
      case "SEARCH":
        if (banner.actionTarget) router.push({ pathname: "/search", params: { q: banner.actionTarget } } as any);
        break;
    }
  }, []);

  const hasActiveFilters = filterOnSale || sortBy !== null || activeGrandchild !== null || brandId !== null || searchQuery.trim().length > 0;
  const hasSidebar = subcategories.length > 0;

  const renderTopBanner = (narrow: boolean) => {
    if (topBanners.length === 0 || hasActiveFilters) return null;
    const width = narrow ? contentWidth - 20 : SCREEN_WIDTH - GRID_H_PADDING * 2;
    if (width <= 0) return null;
    return (
      <View style={styles.topBanner}>
        <HeroBannerSlide banner={topBanners[0]} width={width} height={140} onPress={handleBannerPress} />
      </View>
    );
  };

  const renderFilters = () => (
    <CategoryFilterBar
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      pills={grandchildren}
      activePill={activeGrandchild}
      onPillSelect={(gcId) => {
        setActiveGrandchild(gcId);
        scrollToTop();
      }}
      brandName={brandId ? brandTiles.find((b) => b.id === brandId)?.name ?? null : null}
      onClearBrand={() => setBrandId(null)}
      onSale={filterOnSale}
      onToggleSale={() => setFilterOnSale((v) => !v)}
      sortBy={sortBy}
      onSortChange={setSortBy}
    />
  );

  const renderProductGrid = (narrow: boolean) => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (products.length === 0) {
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
        products={products}
        layout="grid"
        sortBy={sortBy ?? undefined}
        cardWidth={narrow && contentWidth > 0 ? (contentWidth - 20 - GRID_GAP) / 2 : GRID_CARD_WIDTH}
        ListHeaderComponent={renderTopBanner(narrow)}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.pageLoader} color={colors.primary} /> : null}
        midSlot={{
          afterRows: 2,
          bleed: narrow ? styles.gridNarrow.paddingHorizontal : styles.grid.paddingHorizontal,
          element: <ShopByBrands brands={brandTiles} selectedId={brandId} onSelect={setBrandId} onVisit={(b) => router.push(`/brand/${b.id}`)} />,
        }}
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
            <CategorySidebar subcategories={subcategories} activeId={activeSub} onSelect={handleSubcategoryPress} />

            {/* Right content */}
            <View
              style={styles.contentArea}
              onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
            >
              {renderFilters()}
              {renderProductGrid(true)}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {renderFilters()}
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
  contentArea: {
    flex: 1,
    backgroundColor: colors.surface,
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
    marginBottom: 12,
  },
  pageLoader: {
    paddingVertical: spacing.md,
  },
});
