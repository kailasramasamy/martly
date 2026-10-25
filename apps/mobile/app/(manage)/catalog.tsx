import { useRef } from "react";
import { View, FlatList, RefreshControl, TouchableOpacity, Text, StyleSheet, useWindowDimensions } from "react-native";
import { Loader } from "../../components/Loader";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { can } from "@martly/shared/permissions";
import { colors, fonts } from "../../constants/theme";
import { useAuth } from "../../lib/auth-context";
import { useManageScope } from "../../lib/manage-scope-context";
import { ManageHeader } from "../../components/manage/ManageHeader";
import { EmptyState } from "../../components/manage/ui/EmptyState";
import { manage } from "../../components/manage/ui/tokens";
import { CatalogHeader } from "../../components/manage/inventory/CatalogHeader";
import { StoreProductTile } from "../../components/manage/inventory/StoreProductTile";
import { CatalogEmpty } from "../../components/manage/inventory/CatalogEmpty";
import { useCatalog } from "../../components/manage/inventory/use-catalog";
import type { StoreProductItem } from "../../components/manage/inventory/types";
import { useTabBarAutoHide } from "../../lib/tab-bar-visibility";

const COLUMNS = 3;
// Matches the header's side padding so the grid lines up with the search box above it
const GRID_PAD = 16;
const GRID_GAP = 8;

function AddProductButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.add} onPress={onPress} accessibilityRole="button" accessibilityLabel="Add product" activeOpacity={0.8}>
      <Ionicons name="add" size={18} color={colors.accentText} />
      <Text style={styles.addLabel}>Add product</Text>
    </TouchableOpacity>
  );
}

export default function ManageCatalogScreen() {
  const tabBarScroll = useTabBarAutoHide();
  const router = useRouter();
  const { user } = useAuth();
  const { storeId, store, loading: scopeLoading } = useManageScope();
  const { summary, list, search, setSearch, filter, setFilter, facet, setFacet, refreshAll } = useCatalog(storeId);
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<StoreProductItem>>(null);
  const tileWidth = Math.floor((width - GRID_PAD * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS);

  const openRow = (item: StoreProductItem) => router.push(`/manage/store-products/${item.id}`);
  const headerRight = can(user, "store-products", "create") || can(user, "catalog-drafts", "create") || can(user, "products", "create")
    ? <AddProductButton onPress={() => router.push("/manage/add-product")} />
    : undefined;

  if (!storeId) {
    return (
      <View style={styles.root}>
        <ManageHeader title="Inventory" />
        {scopeLoading ? <Loader style={styles.loading} /> : (
          <EmptyState icon="storefront-outline" title="Pick a store" message="Stock and prices are set per store. Choose one from the switcher above. The shared product catalog is under More." />
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ManageHeader title="Inventory" subtitle={store ? `Stock & prices at ${store.name}` : undefined} right={headerRight} collapsed={tabBarScroll.headerCollapsed} />
      <FlatList {...tabBarScroll.scrollProps}
        ref={listRef}
        data={list.loading ? [] : list.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <StoreProductTile item={item} width={tileWidth} onPress={() => openRow(item)} />}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={tabBarScroll.contentStyle(styles.grid)}
        ListHeaderComponent={
          <CatalogHeader
            summary={summary} search={search} onSearch={setSearch} filter={filter} onFilter={setFilter}
            facets={list.meta?.facets?.subcategories} facet={facet} onFacet={setFacet}
            onSearchFocus={() => listRef.current?.scrollToOffset({ offset: 0, animated: false })}
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={refreshAll} tintColor={colors.primary} />}
        ListEmptyComponent={<CatalogEmpty loading={list.loading} error={list.error} filtered={!!search || filter !== "all"} onRetry={refreshAll}
          grid={{ columns: COLUMNS, width: tileWidth, gap: GRID_GAP, padding: GRID_PAD }} />}
        ListFooterComponent={list.loadingMore ? <Loader style={styles.loading} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  loading: { marginTop: 40 },
  grid: { paddingBottom: GRID_PAD, gap: GRID_GAP },
  gridRow: { gap: GRID_GAP, paddingHorizontal: GRID_PAD },
  add: {
    flexDirection: "row", alignItems: "center", gap: 4, height: 36, paddingHorizontal: 12,
    borderRadius: 18, backgroundColor: colors.accent,
  },
  addLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.accentText },
});
