import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { colors, spacing } from "../../constants/theme";
import { getCategoryIcon } from "../../constants/category-icons";
import { SkeletonBox } from "../../components/SkeletonLoader";
import { CategoryTile } from "../../components/CategoryTile";
import { useLanguage } from "../../lib/language-context";
import type { DepartmentNode, CategoryNode } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 16;
const GRID_GAP = 10;
const COLS = 3;
const CARD_WIDTH = (SCREEN_WIDTH - H_PADDING * 2 - GRID_GAP * (COLS - 1)) / COLS;

// Categories panel (inside the padded panel card): 4 tiles per row
const PANEL_PADDING = 14;
const SUB_GAP = 10;
const SUB_TILE_SIZE = Math.floor((SCREEN_WIDTH - H_PADDING * 2 - PANEL_PADDING * 2 - 2 - SUB_GAP * 3) / 4);

type GridRow = { key: string; items: (DepartmentNode | null)[]; expandedIndex: number };

export default function CategoriesScreen() {
  const { getLocalizedName } = useLanguage();
  const [categories, setCategories] = useState<DepartmentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const listRef = useRef<FlatList<GridRow>>(null);

  const fetchCategories = useCallback(() => {
    return api
      .get<DepartmentNode[]>("/api/v1/categories/tree")
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCategories().finally(() => setLoading(false));
  }, [fetchCategories]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCategories();
    setRefreshing(false);
  }, [fetchCategories]);

  const handlePress = useCallback((dept: DepartmentNode) => {
    if (dept.categories.length === 0) {
      router.push({ pathname: "/category/[id]", params: { id: dept.id } });
      return;
    }
    const opening = expandedId !== dept.id;
    setExpandedId(opening ? dept.id : null);
    if (!opening) return;
    // Bring the tapped row to the top so its categories panel (rendered below it) is visible
    const rowIndex = Math.floor(categories.findIndex((c) => c.id === dept.id) / COLS);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: rowIndex, viewPosition: 0, animated: true });
    });
  }, [expandedId, categories]);

  const handleSubcategoryPress = useCallback((categoryId: string) => {
    router.push({ pathname: "/category/[id]", params: { id: categoryId } });
  }, []);

  const handleBrowseAll = useCallback((categoryId: string) => {
    router.push({ pathname: "/category/[id]", params: { id: categoryId } });
  }, []);

  // Build rows for 3-column grid
  const gridData: GridRow[] = [];
  for (let i = 0; i < categories.length; i += COLS) {
    const items: (DepartmentNode | null)[] = [];
    for (let j = 0; j < COLS; j++) items.push(categories[i + j] ?? null);
    const expandedIndex = items.findIndex((c) => c && expandedId === c.id);
    gridData.push({ key: categories[i].id, items, expandedIndex });
  }

  if (loading) return <CategoriesSkeleton />;

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <TouchableOpacity style={styles.searchBar} onPress={() => router.push("/search")}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <Text style={styles.searchPlaceholder}>Search categories...</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={gridData}
        onScrollToIndexFailed={({ averageItemLength, index }) =>
          listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: true })
        }
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => {
          const expandedCat = item.expandedIndex >= 0 ? item.items[item.expandedIndex] : null;

          return (
            <View>
              {/* Card row */}
              <View style={styles.gridRow}>
                {item.items.map((cat, idx) =>
                  cat ? (
                    <CategoryGridCard
                      key={cat.id}
                      category={cat}
                      isExpanded={expandedId === cat.id}
                      onPress={handlePress}
                    />
                  ) : (
                    <View key={`empty-${idx}`} style={styles.cardPlaceholder} />
                  ),
                )}
              </View>

              {/* Expanded categories */}
              {expandedCat && expandedCat.categories.length > 0 && (
                <View style={styles.subcategoryPanel}>
                  <View style={styles.subcategoryHeader}>
                    <Text style={styles.subcategoryTitle}>
                      {getLocalizedName(expandedCat)}
                    </Text>
                    <TouchableOpacity onPress={() => handleBrowseAll(expandedCat.id)}>
                      <Text style={styles.browseAllText}>Browse All</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.subcategoryGrid}>
                    {expandedCat.categories.map((sub) => (
                      <CategoryTile
                        key={sub.id}
                        title={getLocalizedName(sub)}
                        imageUrl={sub.imageUrl}
                        fallbackIcon={getCategoryIcon(sub.name)}
                        size={SUB_TILE_SIZE}
                        onPress={() => handleSubcategoryPress(sub.id)}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="grid-outline" size={32} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>No categories yet</Text>
            <Text style={styles.emptySubtitle}>
              Categories will appear here once they're set up
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 24 }} />}
      />
    </View>
  );
}

// ── Category Grid Card ──

function CategoryGridCard({
  category,
  isExpanded,
  onPress,
}: {
  category: DepartmentNode;
  isExpanded: boolean;
  onPress: (dept: DepartmentNode) => void;
}) {
  const { getLocalizedName } = useLanguage();
  const hasChildren = category.categories.length > 0;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isExpanded && styles.cardExpanded,
      ]}
      onPress={() => onPress(category)}
      activeOpacity={0.7}
    >
      <View style={styles.cardIconArea}>
        {category.imageUrl ? (
          <Image
            source={{ uri: category.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name={getCategoryIcon(category.name)} size={32} color={colors.primary} />
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={2}>
          {getLocalizedName(category)}
        </Text>
        {hasChildren && (
          <View style={styles.cardMeta}>
            <Text style={styles.cardCount}>
              {category.categories.length} categories
            </Text>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={12}
              color="#94a3b8"
            />
          </View>
        )}
        {!hasChildren && (
          <View style={styles.cardMeta}>
            <Ionicons name="arrow-forward" size={12} color="#94a3b8" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Skeleton ──

function CategoriesSkeleton() {
  return (
    <View style={styles.container}>
      <View style={[styles.searchBar, { opacity: 0.5 }]}>
        <SkeletonBox width={18} height={18} borderRadius={9} />
        <SkeletonBox width={140} height={14} />
      </View>
      <View style={styles.list}>
        {[1, 2, 3].map((row) => (
          <View key={row} style={styles.gridRow}>
            {[1, 2, 3].map((col) => (
              <View key={col} style={styles.skeletonCard}>
                <View style={{ width: "100%", aspectRatio: 1 }} />
                <View style={{ padding: 10, gap: 4 }}>
                  <SkeletonBox width="70%" height={12} />
                  <SkeletonBox width="50%" height={10} />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8faf9" },

  // ── Search ──
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: H_PADDING,
    marginTop: 8,
    marginBottom: 4,
    gap: 10,
  },
  searchPlaceholder: { fontSize: 14, color: "#94a3b8" },

  // ── List ──
  list: { paddingHorizontal: H_PADDING, paddingTop: 8 },

  // ── Grid ──
  gridRow: {
    flexDirection: "row",
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },

  // ── Card ──
  cardExpanded: { borderColor: colors.primary, borderWidth: 1.5 },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPlaceholder: {
    width: CARD_WIDTH,
  },
  cardIconArea: {
    width: "100%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0fdfa",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardContent: {
    padding: 10,
  },
  cardName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 17,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  cardCount: {
    fontSize: 11,
    color: "#94a3b8",
  },

  // ── Subcategory Panel ──
  subcategoryPanel: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: PANEL_PADDING,
    marginBottom: GRID_GAP,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  subcategoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  subcategoryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  browseAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  subcategoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: SUB_GAP,
    rowGap: 14,
  },

  // ── Empty ──
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
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
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
  },

  // ── Skeleton ──
  skeletonCard: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
});
