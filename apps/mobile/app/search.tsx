import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, Text, TextInput, TouchableOpacity, Keyboard, StyleSheet } from "react-native";
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
import { ProductActionsProvider } from "../lib/product-actions";
import { FloatingCart } from "../components/FloatingCart";
import { ProductGridSkeleton } from "../components/SkeletonLoader";
import { SearchTabs, tabLabel } from "../components/search/SearchTabs";
import { SearchLoadingOverlay } from "../components/search/SearchTabStatus";
import { CollapsingHeader, useCollapsingHeader } from "../components/search/CollapsingHeader";
import { SearchControlBar } from "../components/search/SearchControlBar";
import { SearchEmptyState } from "../components/search/SearchEmptyState";
import { SearchSheets, type SheetName } from "../components/search/SearchSheets";
import { SearchLanding } from "../components/search/landing/SearchLanding";
import { SearchMetaBanner } from "../components/search/SearchMetaBanner";
import { BrandFilterRow } from "../components/search/BrandFilterRow";
import { SuggestionPanel, suggestionRows } from "../components/search/SuggestionPanel";
import { useSearchSuggestions } from "../lib/use-search-suggestions";
import { useRecentSearches } from "../lib/recent-searches";
import { useSearchLanding } from "../lib/use-search-landing";
import { useSearchCommit } from "../lib/use-search-commit";
import type { SearchEventType } from "@martly/shared/constants";
import type { DepartmentNode, SearchFacets } from "../lib/types";

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

// Animated wrapper so the header can follow scroll on the native thread
const AnimatedProductList = Animated.createAnimatedComponent(ProductList);

function SearchFacetControls({ facets, filters, search, onOpenSheet, hidden }: {
  facets: SearchFacets;
  hidden: boolean;
  filters: SearchFilters;
  search: ReturnType<typeof useProductSearch>;
  onOpenSheet: (sheet: SheetName) => void;
}) {
  return (
    <>
      <SearchTabs facets={facets} active={filters.tab} onSelect={search.selectTab} hidden={hidden} />
      <SearchControlBar
        filterCount={filters.brandIds.length + (filters.foodType ? 1 : 0)}
        brandCount={filters.brandIds.length}
        hasBrands={facets.brands.length > 1 || filters.brandIds.length > 0}
        sortBy={filters.sortBy}
        size={filters.size}
        offers={filters.offers}
        offerCount={facets.offerCount}
        hasSizes={facets.sizes.length > 0 || filters.size != null}
        onOpenFilters={() => onOpenSheet("filters")}
        onOpenBrand={() => onOpenSheet("brand")}
        onOpenSort={() => onOpenSheet("sort")}
        onOpenQuantity={() => onOpenSheet("quantity")}
        onToggleOffers={() => search.patchFilters({ offers: !filters.offers })}
      />
    </>
  );
}

function SearchInput({ value, onChangeText, onSubmit, autoVoice }: {
  value: string; onChangeText: (text: string) => void; onSubmit: () => void; autoVoice: boolean;
}) {
  const ref = useRef<TextInput>(null);
  const [partial, setPartial] = useState("");
  const [focused, setFocused] = useState(false);
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
          onSubmitEditing={onSubmit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {focused && !voice.listening && value.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => onChangeText("")}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
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

function ResultsHeader({ header, search, selectTab, onOpenSheet, showMeta }: {
  header: ReturnType<typeof useCollapsingHeader>;
  search: ReturnType<typeof useProductSearch>;
  selectTab: ReturnType<typeof useProductSearch>["selectTab"];
  onOpenSheet: (sheet: SheetName) => void;
  showMeta: boolean;
}) {
  const { facets, filters, textMode, searchMeta } = search;
  const showFacets = textMode && !!facets;
  return (
    <CollapsingHeader
      header={header}
      full={(hidden) => (
        <>
          {showFacets && facets && <SearchFacetControls facets={facets} filters={filters} search={{ ...search, selectTab }} onOpenSheet={onOpenSheet} hidden={hidden} />}
          {showFacets && facets && (
            <BrandFilterRow brands={facets.brands} selectedIds={filters.brandIds} onChange={(brandIds) => search.patchFilters({ brandIds })} />
          )}
          {showMeta && searchMeta && (
            <SearchMetaBanner meta={searchMeta} typed={search.activeQuery} onSearchInstead={() => search.runQuery(search.activeQuery, { exact: true })} />
          )}
        </>
      )}
      compact={(hidden) => (showFacets && facets ? <SearchTabs facets={facets} active={filters.tab} onSelect={selectTab} compact hidden={hidden} /> : null)}
    />
  );
}

function SearchResults({ search, categoryId, commit, onOpenSheet }: {
  search: ReturnType<typeof useProductSearch>;
  categoryId?: string;
  commit: () => void;
  onOpenSheet: (sheet: SheetName) => void;
}) {
  const { filters, facets, textMode, results, loading } = search;
  const header = useCollapsingHeader();
  const selectTab: typeof search.selectTab = (tab) => {
    commit();
    search.selectTab(tab);
  };


  const showMeta = search.searchMeta && search.searchMeta.strategy !== "keyword" && results.length > 0;
  const activeTab = textMode && facets && filters.tab ? tabLabel(facets, filters.tab) : null;
  const showFacets = textMode && !!facets;
  const headerHeight = showFacets || showMeta ? header.fullHeight : 0;

  return (
    <View style={styles.results}>
      <AnimatedProductList
        products={results}
        layout="grid"
        numColumns={textMode ? 3 : 2}
        key={textMode ? "compact" : "regular"}
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.grid, { paddingTop: headerHeight + spacing.xs }]}
        scrollIndicatorInsets={{ top: headerHeight }}
        onEndReached={textMode ? undefined : search.loadMore}
        onEndReachedThreshold={0.3}
        onScrollBeginDrag={() => {
          Keyboard.dismiss();
          commit();
        }}
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <ProductGridSkeleton columns={textMode ? 3 : 2} rows={textMode ? 4 : 3} />
          ) : (
            <SearchEmptyState filtered={textMode && hasActiveFilters(filters)} hasQuery={!!search.query || !!categoryId} onClearFilters={search.clearFilters} />
          )
        }
        ListFooterComponent={loading && results.length > 0 && !textMode ? <ProductGridSkeleton columns={2} rows={1} /> : null}
      />
      {textMode && loading && results.length > 0 && <SearchLoadingOverlay label={activeTab} top={headerHeight} />}
      {(showFacets || showMeta) && (
        <ResultsHeader header={header} search={search} selectTab={selectTab} onOpenSheet={onOpenSheet} showMeta={!!showMeta} />
      )}
    </View>
  );
}

// Typeahead overlay: opens while typing, closes on pick, submit, scroll or when the keyboard goes away
function useSuggestionPanel(storeId: string | undefined, search: ReturnType<typeof useProductSearch>, recent: string[]) {
  const [open, setOpen] = useState(false);
  const { suggestions } = useSearchSuggestions(storeId, open ? search.query : "");
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => setOpen(false));
    return () => sub.remove();
  }, []);
  const rows = open ? suggestionRows(search.query, suggestions, recent) : [];
  return {
    visible: rows.length > 0,
    suggestions,
    close: () => setOpen(false),
    onChangeText: (text: string) => {
      search.changeQuery(text);
      setOpen(text.trim().length > 0);
    },
    select: (text: string) => {
      setOpen(false);
      Keyboard.dismiss();
      search.runQuery(text);
    },
    // ↖ puts the suggestion in the box to keep refining, like Instamart
    fill: (text: string) => search.changeQuery(`${text} `),
  };
}

export default function SearchScreen() {
  const { categoryId, hasDiscount, sortBy, q, voice } = useLocalSearchParams<{
    categoryId?: string; hasDiscount?: string; sortBy?: string; q?: string; voice?: string;
  }>();
  const { selectedStore } = useStore();
  const search = useProductSearch(selectedStore?.id, { categoryId, hasDiscount, sortBy }, q ?? "");
  const { filters, facets, results, loading } = search;
  const [sheet, setSheet] = useState<SheetName | null>(null);
  useScreenTitle(categoryId, hasDiscount, sortBy);
  const isDeepLink = !!(categoryId || hasDiscount || sortBy);
  const showLanding = !isDeepLink && !search.query.trim();
  const landing = useSearchLanding(selectedStore?.id, !isDeepLink);
  const recents = useRecentSearches();
  const { commit, track } = useSearchCommit(selectedStore?.id, search.activeQuery, results.length, loading, recents.add);
  const productOrder = useMemo(() => [...new Set(results.map((r) => r.product.id))], [results]);
  const trackResult = useCallback(
    (productId: string, type: SearchEventType) => track(productId, type, productOrder.indexOf(productId)),
    [track, productOrder],
  );

  const panel = useSuggestionPanel(selectedStore?.id, search, recents.recent);
  const runChip = (query: string) => {
    Keyboard.dismiss();
    search.runQuery(query);
  };
  const submit = () => {
    panel.close();
    commit();
  };
  return (
    <ProductActionsProvider store={selectedStore ?? null} onTrack={search.textMode ? trackResult : undefined}>
      <View style={styles.container}>
        <SearchInput value={search.query} onChangeText={panel.onChangeText} onSubmit={submit} autoVoice={voice === "1"} />
        <View style={styles.body}>
          {showLanding ? (
            <SearchLanding
              data={landing.data}
              loading={landing.loading}
              recent={recents.recent}
              onSearch={runChip}
              onRemoveRecent={recents.remove}
              onClearRecent={recents.clear}
              onCategory={(id) => router.push({ pathname: "/search", params: { categoryId: id } })}
            />
          ) : (
            <SearchResults search={search} categoryId={categoryId} commit={commit} onOpenSheet={setSheet} />
          )}
          {panel.visible && (
            <SuggestionPanel query={search.query} suggestions={panel.suggestions} recent={recents.recent} onSelect={panel.select} onFill={panel.fill} />
          )}
        </View>
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
  clearButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  micButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  micButtonActive: { backgroundColor: colors.error, transform: [{ scale: 0.8 }] },
  body: { flex: 1 },
  results: { flex: 1, overflow: "hidden" },
  grid: { paddingHorizontal: GRID_H_PADDING, paddingBottom: spacing.xl },
});
