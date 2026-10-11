import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View, type FlatList, type TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useStore } from "../../lib/store-context";
import { useLanguage } from "../../lib/language-context";
import { ProductActionsProvider } from "../../lib/product-actions";
import { groupBrandProducts, searchBrandListings, type BrandCategory, type BrandSection } from "../../lib/brand-store";
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
  onScroll: (...args: unknown[]) => void;
  register: (list: ListHandle | null) => void;
}

function useCollapsingScroll(resetKey: string) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const listRef = useRef<ListHandle | null>(null);
  const [inset, setInset] = useState(0);
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false }), [scrollY]);
  const register = useCallback((list: ListHandle | null) => { listRef.current = list; }, []);
  // A new view (tab, chip, search) mounts its list at the top, so the header must expand to match
  useEffect(() => scrollY.setValue(0), [resetKey, scrollY]);

  const scrollToTop = useCallback(() => {
    const list = listRef.current;
    if (list && "scrollToOffset" in list) list.scrollToOffset({ offset: 0, animated: false });
    else list?.scrollTo({ y: 0, animated: false });
    scrollY.setValue(0);
  }, [scrollY]);
  const binding: ScrollBinding = { inset, onScroll, register };
  return { scrollY, binding, setInset, scrollToTop };
}

function SectionHeader({ section, color, onSeeAll }: { section: BrandSection; color: string; onSeeAll: () => void }) {
  const { getLocalizedName } = useLanguage();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} numberOfLines={1}>
        {getLocalizedName(section)} <Text style={styles.sectionCount}>{section.productCount}</Text>
      </Text>
      <Pressable style={styles.seeAll} onPress={onSeeAll} hitSlop={8} accessibilityLabel={`See all ${section.name}`}>
        <Text style={[styles.seeAllText, { color }]}>See all</Text>
        <Ionicons name="chevron-forward" size={14} color={color} />
      </Pressable>
    </View>
  );
}

// "All": every subcategory as a horizontal rail, grouped under its category
function AllView({ categories, color, onOpen, scroll }: {
  categories: BrandCategory[]; color: string; onOpen: (catId: string, subId: string) => void; scroll: ScrollBinding;
}) {
  const { getLocalizedName } = useLanguage();
  return (
    <ScrollView
      ref={scroll.register}
      onScroll={scroll.onScroll}
      scrollEventThrottle={16}
      scrollIndicatorInsets={{ top: scroll.inset }}
      contentContainerStyle={[styles.allContent, { paddingTop: scroll.inset }]}
      keyboardDismissMode="on-drag"
    >
      {categories.map((cat) => (
        <View key={cat.id} style={styles.categoryBlock}>
          <View style={styles.categoryTitleRow}>
            <View style={[styles.categoryAccent, { backgroundColor: color }]} />
            <Text style={styles.categoryTitle}>{getLocalizedName(cat)}</Text>
          </View>
          {cat.sections.map((section) => (
            <View key={section.id} style={styles.section}>
              <SectionHeader section={section} color={color} onSeeAll={() => onOpen(cat.id, section.id)} />
              <ProductList products={section.products} layout="rail" />
            </View>
          ))}
        </View>
      ))}
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
      contentContainerStyle={[styles.gridContent, { paddingTop: scroll.inset + 4 }]}
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
  if (!category) return <AllView categories={categories} color={base} onOpen={onTab} scroll={scroll} />;
  const products = category.sections.filter((s) => !sub || s.id === sub).flatMap((s) => s.products);
  return <GridView products={products} header={null} listKey={`${category.id}:${sub ?? "all"}`} scroll={scroll} />;
}

export default function BrandStoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedStore } = useStore();
  const { brand, listings, categories, loading } = useBrandStore(id, selectedStore?.id);
  const [tab, setTab] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const searching = query.trim().length > 0;
  const { scrollY, binding, setInset, scrollToTop } = useCollapsingScroll(`${tab}:${sub}:${searching ? query : ""}`);
  const inputRef = useRef<TextInput>(null);

  const productCount = categories.reduce((n, c) => n + c.productCount, 0);
  const selectTab = (catId: string | null, subId: string | null = null) => { setTab(catId); setSub(subId); setQuery(""); };
  const openSearch = () => { scrollToTop(); setTimeout(() => inputRef.current?.focus(), 50); };
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
            onHeight={setInset}
            onSearchPress={openSearch}
            expanded={
              <>
                <BrandHero brand={brand} productCount={productCount} categoryCount={categories.length} query={query} onQuery={setQuery} inputRef={inputRef} />
                {!searching && <BrandCategoryTiles brand={brand} categories={categories} activeId={tab} onSelect={(c) => selectTab(c)} />}
              </>
            }
            pinned={category && <SubChips key={category.id} category={category} active={sub} color={brandTheme(brand).base} onChange={setSub} />}
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
  categoryTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 6 },
  categoryAccent: { width: 4, height: 20, borderRadius: 2 },
  categoryTitle: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.text, letterSpacing: -0.3 },
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
