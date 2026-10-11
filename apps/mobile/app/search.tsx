import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Keyboard, StyleSheet } from "react-native";
import { useLocalSearchParams, useNavigation, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { useLanguage } from "../lib/language-context";
import { useProductSearch, hasActiveFilters, type SearchFilters } from "../lib/use-product-search";
import { useVoiceInput } from "../lib/use-voice-input";
import { colors, spacing, fontSize } from "../constants/theme";
import { GRID_H_PADDING } from "../components/FeaturedProductCard";
import { ProductList } from "../components/ProductList";
import { ShopByBrands } from "../components/ShopByBrands";
import { ProductActionsProvider } from "../lib/product-actions";
import { FloatingCart } from "../components/FloatingCart";
import { ProductCardSkeleton } from "../components/SkeletonLoader";
import { SearchTagTabs } from "../components/search/SearchTagTabs";
import { SearchControlBar } from "../components/search/SearchControlBar";
import { SearchEmptyState } from "../components/search/SearchEmptyState";
import { SearchSheets, type SheetName } from "../components/search/SearchSheets";
import type { DepartmentNode, SearchFacets, SearchMeta } from "../lib/types";

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

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function useScreenTitle(categoryId: string | undefined, hasDiscount: string | undefined, sortBy: string | undefined) {
  const navigation = useNavigation();
  const { getLocalizedName } = useLanguage();
  const [tree, setTree] = useState<TreeNode[]>([]);

  useEffect(() => {
    if (!categoryId) return;
    api.get<DepartmentNode[]>("/api/v1/categories/tree").then((res) => setTree(toTreeNodes(res.data))).catch(() => {});
  }, [categoryId]);

  useEffect(() => {
    let title = "Search";
    if (hasDiscount === "true") title = "Today's Deals";
    else if (sortBy === "newest") title = "New Arrivals";
    else if (categoryId) {
      const node = findNode(tree, categoryId);
      title = node ? getLocalizedName(node) : "Products";
    }
    navigation.setOptions({ title });
  }, [categoryId, tree, navigation, hasDiscount, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps
}

function SearchMetaBanner({ meta }: { meta: SearchMeta }) {
  return (
    <View style={styles.searchMetaBanner}>
      <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
      <Text style={styles.searchMetaText}>
        Showing results for{" "}
        <Text style={styles.searchMetaBold}>
          {meta.correctedQuery ?? meta.expandedTerms?.join(", ") ?? "similar products"}
        </Text>
      </Text>
    </View>
  );
}

function SearchFacetControls({ facets, filters, search, onOpenSheet }: {
  facets: SearchFacets;
  filters: SearchFilters;
  search: ReturnType<typeof useProductSearch>;
  onOpenSheet: (sheet: SheetName) => void;
}) {
  return (
    <>
      <SearchTagTabs tags={facets.tags} activeTag={filters.tag} onSelect={search.selectTag} />
      <SearchControlBar
        filterCount={filters.brandIds.length + (filters.foodType ? 1 : 0)}
        sortBy={filters.sortBy}
        size={filters.size}
        offers={filters.offers}
        offerCount={facets.offerCount}
        hasSizes={facets.sizes.length > 0 || filters.size != null}
        onOpenFilters={() => onOpenSheet("filters")}
        onOpenSort={() => onOpenSheet("sort")}
        onOpenQuantity={() => onOpenSheet("quantity")}
        onToggleOffers={() => search.patchFilters({ offers: !filters.offers })}
      />
    </>
  );
}

function SearchInput({ value, onChangeText, autoVoice }: { value: string; onChangeText: (text: string) => void; autoVoice: boolean }) {
  const ref = useRef<TextInput>(null);
  const [partial, setPartial] = useState("");
  const voice = useVoiceInput(setPartial, (text) => {
    setPartial("");
    onChangeText(text);
  });

  useEffect(() => {
    if (autoVoice && voice.available) {
      voice.start();
      return;
    }
    const t = setTimeout(() => ref.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVoice = () => {
    if (voice.listening) return voice.stop();
    Keyboard.dismiss();
    setPartial("");
    voice.start();
  };

  return (
    <View style={styles.searchRow}>
      <View style={[styles.searchBox, voice.listening && styles.searchBoxListening]}>
        <TextInput
          ref={ref}
          style={styles.searchInput}
          placeholder={voice.listening ? "Listening\u2026" : "Search products..."}
          placeholderTextColor={voice.listening ? colors.primary : colors.textSecondary}
          value={voice.listening ? partial : value}
          onChangeText={onChangeText}
          editable={!voice.listening}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {voice.available && (
          <TouchableOpacity
            style={[styles.micButton, voice.listening && styles.micButtonActive]}
            onPress={toggleVoice}
            accessibilityRole="button"
            accessibilityLabel={voice.listening ? "Stop voice search" : "Search by voice"}
          >
            <Ionicons name={voice.listening ? "stop" : "mic-outline"} size={20} color={voice.listening ? "#fff" : colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function SearchScreen() {
  const { categoryId, hasDiscount, sortBy, q, voice } = useLocalSearchParams<{
    categoryId?: string; hasDiscount?: string; sortBy?: string; q?: string; voice?: string;
  }>();
  const { selectedStore } = useStore();
  const search = useProductSearch(selectedStore?.id, { categoryId, hasDiscount, sortBy }, q ?? "");
  const { filters, facets, textMode, results, loading } = search;
  const [sheet, setSheet] = useState<SheetName | null>(null);
  useScreenTitle(categoryId, hasDiscount, sortBy);

  const brandStrip = textMode && facets ? (
    <ShopByBrands
      brands={facets.brands.slice(0, 10)}
      selectedId={filters.brandIds.length === 1 ? filters.brandIds[0] : null}
      onSelect={(id) => search.patchFilters({ brandIds: id ? [id] : [] })}
      onVisit={(b) => router.push(`/brand/${b.id}`)}
    />
  ) : null;

  const showMeta = search.searchMeta && search.searchMeta.strategy !== "keyword" && results.length > 0;

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={styles.container}>
        <SearchInput value={search.query} onChangeText={search.changeQuery} autoVoice={voice === "1"} />
        {textMode && facets && (
          <SearchFacetControls facets={facets} filters={filters} search={search} onOpenSheet={setSheet} />
        )}
        {showMeta && search.searchMeta && <SearchMetaBanner meta={search.searchMeta} />}
        <ProductList
          products={results}
          layout="grid"
          numColumns={textMode ? 3 : 2}
          key={textMode ? "compact" : "regular"}
          midSlot={{ afterRows: 2, element: brandStrip }}
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.grid}
          onEndReached={textMode ? undefined : search.loadMore}
          onEndReachedThreshold={0.3}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            loading ? (
              <View>{[1, 2, 3].map((i) => <ProductCardSkeleton key={i} />)}</View>
            ) : (
              <SearchEmptyState filtered={textMode && hasActiveFilters(filters)} hasQuery={!!search.query || !!categoryId} onClearFilters={search.clearFilters} />
            )
          }
          ListFooterComponent={loading && results.length > 0 && !textMode ? <ProductCardSkeleton /> : null}
        />
        <SearchSheets sheet={sheet} onClose={() => setSheet(null)} facets={facets} filters={filters} onChange={search.patchFilters} />
        <FloatingCart />
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchRow: { padding: spacing.md, paddingBottom: spacing.xs },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  searchBoxListening: { borderColor: colors.primary },
  searchInput: {
    flex: 1,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    letterSpacing: 0,
    color: colors.text,
  },
  micButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  micButtonActive: { backgroundColor: colors.error, transform: [{ scale: 0.8 }] },
  grid: { paddingHorizontal: GRID_H_PADDING, paddingTop: spacing.xs, paddingBottom: spacing.xl },
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
  searchMetaText: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
  searchMetaBold: { fontWeight: "600", color: colors.text },
});
