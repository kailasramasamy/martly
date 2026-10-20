import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, Dimensions, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CategoryDirectoryPage } from "@martly/shared/types";
import { api } from "../../lib/api";
import { colors, spacing } from "../../constants/theme";
import { SkeletonBox } from "../../components/SkeletonLoader";
import { DepartmentGroup } from "../../components/category-directory/DepartmentGroup";
import { StoreGridSection } from "../../components/home/sections/StoreGridSection";
import { useStore } from "../../lib/store-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { useTabBarAutoHide } from "../../lib/tab-bar-visibility";

const H_PADDING = 16;
const GAP = 10;
// One quiet grey behind every tile, so the product art carries the colour
const TILE_BACKGROUND = "#f1f5f9";
const SKELETON_TILE = Math.floor((Dimensions.get("window").width - H_PADDING * 2 - GAP * 3) / 4);

type Group = CategoryDirectoryPage["groups"][number];

/** Every department the store stocks, its categories as tiles four to a row, then Shop by store */
export default function CategoriesScreen() {
  const tabBarScroll = useTabBarAutoHide();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;
  const [directory, setDirectory] = useState<CategoryDirectoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDirectory = useCallback(() => {
    if (!storeId) return Promise.resolve();
    return api
      .get<CategoryDirectoryPage>(`/api/v1/home/${storeId}/directory`)
      .then((res) => setDirectory(res.data))
      .catch(() => {});
  }, [storeId]);

  useEffect(() => {
    setLoading(true);
    fetchDirectory().finally(() => setLoading(false));
  }, [fetchDirectory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDirectory();
    setRefreshing(false);
  }, [fetchDirectory]);

  const renderGroup = useCallback(
    ({ item }: { item: Group }) => (
      <View style={styles.group}>
        <DepartmentGroup group={item} tint={TILE_BACKGROUND} />
      </View>
    ),
    [],
  );

  if (loading && !directory) return <CategoriesSkeleton />;

  return (
    <FlatList keyboardDismissMode="on-drag" {...tabBarScroll.scrollProps}
      style={styles.container}
      data={directory?.groups ?? []}
      keyExtractor={(g) => g.departmentId}
      renderItem={renderGroup}
      contentContainerStyle={tabBarScroll.contentStyle(styles.list)}
      ItemSeparatorComponent={GroupGap}
      ListFooterComponent={directory?.stores ? <StoreGridSection section={directory.stores} /> : null}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
      ListEmptyComponent={<EmptyState />}
    />
  );
}

const GroupGap = () => <View style={styles.groupGap} />;

function EmptyState() {
  const t = useStrings("catalog");
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="grid-outline" size={32} color="#94a3b8" />
      </View>
      <Text style={styles.emptyTitle}>{t.categories.emptyTitle}</Text>
      <Text style={styles.emptySubtitle}>{t.categories.emptySubtitle}</Text>
    </View>
  );
}

function CategoriesSkeleton() {
  return (
    <View style={[styles.container, styles.list, styles.group]}>
      {[1, 2].map((section) => (
        <View key={section} style={styles.skeletonGroup}>
          <SkeletonBox width={160} height={18} />
          {[1, 2].map((row) => (
            <View key={row} style={styles.skeletonRow}>
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonBox key={i} width={SKELETON_TILE} height={SKELETON_TILE} borderRadius={16} />
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  // Only the department groups take the side gutter; Shop by store paints its own full-width band
  list: { paddingTop: spacing.md, paddingBottom: spacing.xl },
  group: { paddingHorizontal: H_PADDING },
  groupGap: { height: 28 },
  skeletonGroup: { gap: GAP, marginBottom: 28 },
  skeletonRow: { flexDirection: "row", gap: GAP },
  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#f1f5f9",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: "#94a3b8", textAlign: "center", lineHeight: 18 },
});
