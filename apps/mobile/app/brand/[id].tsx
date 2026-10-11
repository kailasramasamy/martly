import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type FlatList, type TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useStore } from "../../lib/store-context";
import { useLanguage } from "../../lib/language-context";
import { ProductActionsProvider } from "../../lib/product-actions";
import { brandHomeBlocks, groupBrandProducts, searchBrandListings, type BrandCategory } from "../../lib/brand-store";
import { brandDisplayName, brandTheme } from "../../lib/brand-strip";
import { ProductList } from "../../components/ProductList";
import { FloatingCart } from "../../components/FloatingCart";
import { BrandHero, BrandCategoryTiles, type BrandInfo } from "../../components/BrandStoreHeader";
import { CollapsingBrandHeader } from "../../components/CollapsingBrandHeader";
import { colors, fonts } from "../../constants/theme";
import type { DepartmentNode, StoreProduct } from "../../lib/types";

function useBrandStore(brandId: string | undefined, storeId: string | undefined) {
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [listings, setListings] = useState<StoreProduct[]>([]);
  const [tree, setTree] = useState<DepartmentNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    api.get<BrandInfo>(`/api/v1/brands/${brandId}`).then((res) => setBrand(res.data)).catch(() => {});
    api.get<DepartmentNode[]>("/api/v1/categories/tree").then((res) => setTree(res.data)).catch(() => {});
  }, [brandId]);

  useEffect(() => {
    if (!brandId || !storeId) { setLoading(false); return; }
    setLoading(true);
    api.getList<StoreProduct>(`/api/v1/stores/${storeId}/products?brandId=${brandId}&pageSize=200`)
      .then((res) => setListings(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [brandId, storeId]);

  const categories = useMemo(() => groupBrandProducts(listings, tree), [listings, tree]);
  return { brand, listings, categories, loading };
}

type ListHandle = ScrollView | FlatList<StoreProduct>;

// Shared by whichever list is showing: drives the collapsing header and pads content to start below it
interface ScrollBinding {
  inset: number;
  // How far the header scrolls before collapsing
  collapse: number;
  onScroll: (...args: unknown[]) => void;
  register: (list: ListHandle | null) => void;
}

function useCollapsingScroll(resetKey: string, chipKey: string) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const listRef = useRef<ListHandle | null>(null);
  const [inset, setInset] = useState(0);
  const [collapse, setCollapse] = useState(0);
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (e: { nativeEvent: { contentOffset: { y: number } } }) => { offset.current = e.nativeEvent.contentOffset.y; },
  }), [scrollY]);
  const register = useCallback((list: ListHandle | null) => { listRef.current = list; }, []);

  const scrollTo = useCallback((y: number) => {
    const list = listRef.current;
    if (list && "scrollToOffset" in list) list.scrollToOffset({ offset: y, animated: false });
    else list?.scrollTo({ y, animated: false });
    offset.current = y;
    scrollY.setValue(y);
  }, [scrollY]);
  // A new view (tab, search) mounts its list at the top, so the header must expand to match
  useEffect(() => { offset.current = 0; scrollY.setValue(0); }, [resetKey, scrollY]);
  // Switching chips keeps the same list: restart it at the top of its products, leaving a collapsed header collapsed
  const lastChip = useRef(chipKey);
  useEffect(() => {
    if (lastChip.current === chipKey) return;
    lastChip.current = chipKey;
    scrollTo(Math.min(offset.current, collapse));
  }, [chipKey, collapse, scrollTo]);

  const onHeight = useCallback((height: number, distance: number) => { setInset(height); setCollapse(distance); }, []);
  const binding: ScrollBinding = { inset, collapse, onScroll, register };
  return { scrollY, binding, onHeight, scrollToTop: () => scrollTo(0) };
}

function SeeAll({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable style={styles.seeAll} onPress={onPress} hitSlop={8} accessibilityLabel={`See all ${label}`}>
      <Text style={[styles.seeAllText, { color }]}>See all</Text>
      <Ionicons name="chevron-forward" size={14} color={color} />
    </Pressable>
  );
}

function RailHeader({ title, count, color, onSeeAll }: { title: string; count: number; color: string; onSeeAll: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} numberOfLines={1}>
        {title} <Text style={styles.sectionCount}>{count}</Text>
      </Text>
      <SeeAll label={title} color={color} onPress={onSeeAll} />
    </View>
  );
}

// "All": categories biggest first, each as rails (see brandHomeBlocks), so thin subcategories don't leave lone cards
function AllView({ categories, brandName, color, onOpen, scroll }: {
  categories: BrandCategory[]; brandName: string; color: string; onOpen: (catId: string, subId: string | null) => void; scroll: ScrollBinding;
}) {
  const { getLocalizedName } = useLanguage();
  const blocks = useMemo(() => brandHomeBlocks(categories), [categories]);
  return (
    <ScrollView
      ref={scroll.register}
      onScroll={scroll.onScroll}
      scrollEventThrottle={16}
      scrollIndicatorInsets={{ top: scroll.inset }}
      contentContainerStyle={[styles.allContent, { paddingTop: scroll.inset }]}
      keyboardDismissMode="on-drag"
    >
      {blocks.map(({ key, category, rails }) => {
        const title = category ? getLocalizedName(category) : `More from ${brandName}`;
        // A category shown as one pooled rail needs no rail header: its title row carries "See all"
        const single = rails.length === 1 && !rails[0].section;
        return (
          <View key={key} style={styles.categoryBlock}>
            <View style={styles.categoryTitleRow}>
              <View style={[styles.categoryAccent, { backgroundColor: color }]} />
              <Text style={styles.categoryTitle} numberOfLines={1}>{title}</Text>
              {single && category && <SeeAll label={title} color={color} onPress={() => onOpen(category.id, null)} />}
            </View>
            {rails.map((rail) => (
              <View key={rail.key} style={styles.section}>
                {!single && category && (
                  <RailHeader
                    title={rail.section ? getLocalizedName(rail.section) : `More in ${title}`}
                    count={rail.productCount}
                    color={color}
                    onSeeAll={() => onOpen(category.id, rail.section?.id ?? null)}
                  />
                )}
                <ProductList products={rail.products} layout="rail" />
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function SubChips({ category, active, color, onChange }: { category: BrandCategory; active: string | null; color: string; onChange: (id: string | null) => void }) {
  const { getLocalizedName } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);
  const chipX = useRef<Record<string, number>>({});
  const activeKey = active ?? "all";
  // Keep the selected chip in view — on tap, and when arriving from "See all" with a chip preselected
  const reveal = (key: string, animated: boolean) => {
    const x = chipX.current[key];
    if (x != null) scrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated });
  };
  useEffect(() => reveal(activeKey, true), [activeKey]);

  if (category.sections.length < 2) return null;
  const chips = [
    { id: null, label: "All", count: category.productCount, imageUrl: null },
    ...category.sections.map((s) => ({ id: s.id, label: getLocalizedName(s), count: s.productCount, imageUrl: s.imageUrl })),
  ];
  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsRow}>
      {chips.map((c) => {
        const selected = c.id === active;
        const key = c.id ?? "all";
        return (
          <Pressable
            key={key}
            onPress={() => onChange(c.id)}
            onLayout={(e) => { chipX.current[key] = e.nativeEvent.layout.x; if (key === activeKey) reveal(key, false); }}
            style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]}
          >
            {c.imageUrl && <Image source={{ uri: c.imageUrl }} style={styles.chipImage} resizeMode="contain" />}
            <Text style={[styles.chipText, selected && styles.chipTextActive]}>{c.label}</Text>
            <Text style={[styles.chipCount, selected && styles.chipTextActive]}>{c.count}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function GridView({ products, header, listKey, scroll }: { products: StoreProduct[]; header: React.ReactElement | null; listKey: string; scroll: ScrollBinding }) {
  const { height } = useWindowDimensions();
  // Room to stay collapsed even when a chip has only a few products
  return (
    <ProductList
      key={listKey}
      ref={scroll.register}
      onScroll={scroll.onScroll}
      scrollEventThrottle={16}
      scrollIndicatorInsets={{ top: scroll.inset }}
      products={products}
      layout="grid"
      ListHeaderComponent={header}
      contentContainerStyle={[styles.gridContent, { paddingTop: scroll.inset + 4, minHeight: height + scroll.collapse }]}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    />
  );
}

function Message({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function BrandBody({ brand, listings, categories, loading, storeName, query, tab, sub, onTab, scroll }: {
  brand: BrandInfo | null; listings: StoreProduct[]; categories: BrandCategory[]; loading: boolean; storeName?: string;
  query: string; tab: string | null; sub: string | null; onTab: (cat: string | null, sub?: string | null) => void; scroll: ScrollBinding;
}) {
  const results = useMemo(() => searchBrandListings(listings, query), [listings, query]);
  const below = (node: React.ReactNode) => <View style={{ paddingTop: scroll.inset }}>{node}</View>;
  if (loading || !brand) return below(<ActivityIndicator style={styles.loader} color={colors.primary} />);
  const name = brandDisplayName(brand.name);
  const { base } = brandTheme(brand);
  if (!categories.length) return below(<Message icon="storefront-outline" title={`${name} isn't stocked here yet`} text={`${storeName ?? "This store"} doesn't list any ${name} products right now.`} />);

  if (query.trim()) {
    if (!results.length) return below(<Message icon="search-outline" title="No matches" text={`Nothing in ${name} matches "${query.trim()}".`} />);
    const header = <Text style={styles.resultsLabel}>{new Set(results.map((r) => r.product.id)).size} results for "{query.trim()}"</Text>;
    return <GridView products={results} header={header} listKey={`search:${query}`} scroll={scroll} />;
  }
  const category = categories.find((c) => c.id === tab);
  if (!category) return <AllView categories={categories} brandName={name} color={base} onOpen={onTab} scroll={scroll} />;
  const products = category.sections.filter((s) => !sub || s.id === sub).flatMap((s) => s.products);
  return <GridView products={products} header={null} listKey={category.id} scroll={scroll} />;
}

export default function BrandStoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedStore } = useStore();
  const { brand, listings, categories, loading } = useBrandStore(id, selectedStore?.id);
  const [tab, setTab] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const searching = query.trim().length > 0;
  const { scrollY, binding, onHeight, scrollToTop } = useCollapsingScroll(`${tab}:${searching ? query : ""}`, `${tab}:${sub}`);
  const inputRef = useRef<TextInput>(null);

  const productCount = categories.reduce((n, c) => n + c.productCount, 0);
  const selectTab = (catId: string | null, subId: string | null = null) => { setTab(catId); setSub(subId); setQuery(""); setSearchOpen(false); };
  const openSearch = () => { scrollToTop(); setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 50); };
  const category = !searching ? categories.find((c) => c.id === tab) : undefined;

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <BrandBody
          brand={brand} listings={listings} categories={categories} loading={loading} storeName={selectedStore?.name}
          query={query} tab={tab} sub={sub} onTab={selectTab} scroll={binding}
        />
        {brand && (
          <CollapsingBrandHeader
            brand={brand}
            scrollY={scrollY}
            onHeight={onHeight}
            onSearchPress={openSearch}
            expanded={
              <>
                <BrandHero brand={brand} productCount={productCount} categoryCount={categories.length} query={query} onQuery={setQuery} inputRef={inputRef} searchOpen={searchOpen} onSearchOpen={(open) => (open ? openSearch() : setSearchOpen(false))} />
                {!searching && <BrandCategoryTiles brand={brand} categories={categories} activeId={tab} onSelect={(c) => selectTab(c)} />}
              </>
            }
            pinned={category && <SubChips key={category.id} category={category} active={sub} color={brandTheme(brand).accent} onChange={setSub} />}
          />
        )}
        <FloatingCart />
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  loader: { marginTop: 48 },
  allContent: { paddingBottom: 120 },
  categoryBlock: { paddingTop: 22 },
  categoryTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 6, minHeight: 32 },
  categoryAccent: { width: 4, height: 20, borderRadius: 2 },
  categoryTitle: { flex: 1, fontFamily: fonts.extrabold, fontSize: 19, color: colors.text, letterSpacing: -0.3 },
  section: { marginTop: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  sectionCount: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  seeAllText: { fontFamily: fonts.bold, fontSize: 13 },
  chipsRow: { flexGrow: 0, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 42, paddingLeft: 5, paddingRight: 12,
    borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff",
  },
  chipImage: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#fff", transform: [{ scale: 1.25 }] },
  chipText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text, marginLeft: 4 },
  chipCount: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary },
  chipTextActive: { color: "#fff" },
  gridContent: { paddingTop: 4, paddingBottom: 120 },
  resultsLabel: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.textSecondary, paddingVertical: 14 },
  empty: { alignItems: "center", paddingHorizontal: 32, paddingTop: 64, gap: 8 },
  emptyTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text, textAlign: "center", marginTop: 6 },
  emptyText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, textAlign: "center", lineHeight: 19 },
});
