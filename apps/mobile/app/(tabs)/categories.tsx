import { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, RefreshControl, type ViewToken } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { colors, fonts, spacing } from "../../constants/theme";
import { getCategoryIcon } from "../../constants/category-icons";
import { SkeletonBox } from "../../components/SkeletonLoader";
import { CategoryTile } from "../../components/CategoryTile";
import { DepartmentStrip } from "../../components/DepartmentStrip";
import { useLanguage } from "../../lib/language-context";
import type { DepartmentNode } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 16;
const COLS = 4;
const TILE_GAP = 10;
const TILE_SIZE = Math.floor((SCREEN_WIDTH - H_PADDING * 2 - TILE_GAP * (COLS - 1)) / COLS);

const openListing = (id: string) => router.push({ pathname: "/category/[id]", params: { id } });
const VIEWABILITY = { itemVisiblePercentThreshold: 40 };

export default function CategoriesScreen() {
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<FlatList<DepartmentNode>>(null);

  // Highlight the topmost visible department in the strip
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<DepartmentNode>[] }) => {
    const top = viewableItems.find((v) => v.isViewable);
    if (top) setActiveId(top.item.id);
  }).current;

  const jumpTo = useCallback((index: number) => {
    setActiveId(departments[index]?.id ?? null);
    listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: true });
  }, [departments]);

  const fetchDepartments = useCallback(() => {
    return api
      .get<DepartmentNode[]>("/api/v1/categories/tree")
      .then((res) => setDepartments(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchDepartments().finally(() => setLoading(false));
  }, [fetchDepartments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDepartments();
    setRefreshing(false);
  }, [fetchDepartments]);

  if (loading) return <CategoriesSkeleton />;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.searchBar} onPress={() => router.push("/search")}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <Text style={styles.searchPlaceholder}>Search products...</Text>
      </TouchableOpacity>

      <DepartmentStrip departments={departments} activeId={activeId} onSelect={jumpTo} />

      <FlatList
        ref={listRef}
        data={departments}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <DepartmentSection department={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListEmptyComponent={<EmptyState />}
        initialNumToRender={departments.length}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
        onScrollToIndexFailed={({ index, averageItemLength }) =>
          listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })
        }
      />
    </View>
  );
}

// A department heading with all its categories in a 4-column grid
function DepartmentSection({ department }: { department: DepartmentNode }) {
  const { getLocalizedName } = useLanguage();
  const tiles = department.categories.length > 0 ? department.categories : [department];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} numberOfLines={1}>{getLocalizedName(department)}</Text>
        <TouchableOpacity
          style={styles.seeAll}
          onPress={() => openListing(department.id)}
          accessibilityRole="button"
          accessibilityLabel={`See all ${department.name}`}
        >
          <Text style={styles.seeAllText}>See all</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {tiles.map((cat) => (
          <CategoryTile
            key={cat.id}
            title={getLocalizedName(cat)}
            imageUrl={cat.imageUrl}
            fallbackIcon={getCategoryIcon(cat.name)}
            size={TILE_SIZE}
            onPress={() => openListing(cat.id)}
          />
        ))}
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="grid-outline" size={32} color="#94a3b8" />
      </View>
      <Text style={styles.emptyTitle}>No categories yet</Text>
      <Text style={styles.emptySubtitle}>Categories will appear here once they're set up</Text>
    </View>
  );
}

function CategoriesSkeleton() {
  return (
    <View style={styles.container}>
      <View style={[styles.searchBar, { opacity: 0.5 }]}>
        <SkeletonBox width={18} height={18} borderRadius={9} />
        <SkeletonBox width={140} height={14} />
      </View>
      <View style={styles.list}>
        {[1, 2].map((section) => (
          <View key={section} style={styles.section}>
            <SkeletonBox width={160} height={18} />
            <View style={[styles.grid, { marginTop: 14 }]}>
              {Array.from({ length: COLS * 2 }, (_, i) => (
                <View key={i} style={{ width: TILE_SIZE, gap: 6 }}>
                  <SkeletonBox width={TILE_SIZE} height={TILE_SIZE} borderRadius={TILE_SIZE * 0.22} />
                  <SkeletonBox width="80%" height={10} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
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
  list: { paddingHorizontal: H_PADDING, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  sectionTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.text, letterSpacing: -0.2 },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44, paddingLeft: spacing.md },
  seeAllText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: TILE_GAP, rowGap: spacing.lg },
  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#f1f5f9",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: "#94a3b8", textAlign: "center", lineHeight: 18 },
});
