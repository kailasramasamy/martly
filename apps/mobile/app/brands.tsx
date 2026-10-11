import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { BrandDirectory } from "@martly/shared/types";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { buildDirectoryItems, TILES_PER_ROW, type DirectoryItem } from "../lib/brand-directory";
import { BrandTile } from "../components/brands/BrandTile";
import { BrandsHero, FeaturedBrands } from "../components/brands/BrandsHero";
import { CategoryHeader, DepartmentBand, DepartmentChips, ViewAllButton } from "../components/brands/DirectoryRows";
import { SkeletonBox } from "../components/SkeletonLoader";
import { colors, fonts } from "../constants/theme";

const TILE_GAP = 10;

function useBrandDirectory(storeId: string | undefined) {
  const [directory, setDirectory] = useState<BrandDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!storeId) { setLoading(false); return Promise.resolve(); }
    setFailed(false);
    return api.get<BrandDirectory>(`/api/v1/brands/store/${storeId}/directory`)
      .then((res) => setDirectory(res.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { directory, loading, failed, load };
}

function LoadingGrid({ tileWidth }: { tileWidth: number }) {
  return (
    <View style={styles.skeleton}>
      <SkeletonBox width={180} height={20} style={styles.skeletonTitle} />
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.row}>
          {[0, 1, 2].map((i) => <SkeletonBox key={i} width={tileWidth} height={96} borderRadius={16} />)}
        </View>
      ))}
    </View>
  );
}

function EmptyState({ query, failed, onRetry }: { query: string; failed: boolean; onRetry: () => void }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={failed ? "cloud-offline-outline" : "storefront-outline"} size={40} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>{failed ? "Couldn't load brands" : query ? `No brand matches "${query}"` : "No brands here yet"}</Text>
      {failed && (
        <Pressable style={styles.retry} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

interface RowProps {
  item: DirectoryItem;
  tileWidth: number;
  header: ReactNode;
  chips: ReactNode;
  empty: ReactNode;
  onOpenBrand: (id: string) => void;
  onExpand: (categoryId: string) => void;
}

function DirectoryRow({ item, tileWidth, header, chips, empty, onOpenBrand, onExpand }: RowProps) {
  switch (item.type) {
    case "header": return header;
    case "chips": return chips;
    case "empty": return empty;
    case "department": return <DepartmentBand department={item.department} brandCount={item.brandCount} />;
    case "category": return <CategoryHeader category={item.category} departmentName={item.departmentName} brandCount={item.brandCount} />;
    case "more": return <ViewAllButton hidden={item.hidden} onPress={() => onExpand(item.categoryId)} />;
    case "row":
      return (
        <View style={styles.row}>
          {item.brands.map((b) => <BrandTile key={b.id} brand={b} width={tileWidth} onPress={() => onOpenBrand(b.id)} />)}
        </View>
      );
  }
}

export default function BrandsScreen() {
  const { selectedStore } = useStore();
  const { directory, loading, failed, load } = useBrandDirectory(selectedStore?.id);
  const { width } = useWindowDimensions();
  const tileWidth = (width - 32 - TILE_GAP * (TILES_PER_ROW - 1)) / TILES_PER_ROW;
  const [query, setQuery] = useState("");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlatList<DirectoryItem>>(null);
  const headerHeight = useRef(0);
  const offset = useRef(0);

  const departments = useMemo(() => directory?.departments ?? [], [directory]);
  const items = useMemo(() => buildDirectoryItems(departments, { departmentId, query, expanded }), [departments, departmentId, query, expanded]);
  const categoryCount = departments.reduce((n, d) => n + d.categories.length, 0);

  // A new filter starts at the top of its brands, with the chips pinned
  const selectDepartment = (id: string | null) => {
    setDepartmentId(id);
    if (offset.current > headerHeight.current) listRef.current?.scrollToOffset({ offset: headerHeight.current, animated: false });
  };
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const renderItem = ({ item }: { item: DirectoryItem }) => (
    <DirectoryRow
      item={item} tileWidth={tileWidth} onOpenBrand={(id) => router.push(`/brand/${id}`)}
      onExpand={(id) => setExpanded((prev) => new Set(prev).add(id))}
      header={
        <View onLayout={(e) => { headerHeight.current = e.nativeEvent.layout.height; }}>
          <BrandsHero storeName={selectedStore?.name} brandCount={directory?.brandCount ?? 0} categoryCount={categoryCount} query={query} onQuery={setQuery} />
          {!query && <FeaturedBrands brands={directory?.featured ?? []} />}
          {loading && <LoadingGrid tileWidth={tileWidth} />}
        </View>
      }
      chips={loading ? null : <DepartmentChips departments={departments} activeId={departmentId} onSelect={selectDepartment} />}
      empty={loading ? null : <EmptyState query={query} failed={failed} onRetry={load} />}
    />
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        stickyHeaderIndices={[1]}
        onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={32}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        initialNumToRender={14}
        windowSize={9}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { paddingBottom: 40 },
  row: { flexDirection: "row", gap: TILE_GAP, paddingHorizontal: 16, marginBottom: TILE_GAP },
  skeleton: { paddingTop: 20, gap: 14 },
  skeletonTitle: { marginLeft: 16 },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, textAlign: "center" },
  retry: { minHeight: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: colors.primary, justifyContent: "center" },
  retryText: { fontFamily: fonts.bold, fontSize: 14, color: "#fff" },
});
