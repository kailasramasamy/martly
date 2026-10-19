import { Fragment, memo, useCallback, useMemo } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { PriceBandDealsSection as PriceBandDeals, PriceBandPage } from "@martly/shared/types";
import { COMPACT_GAP } from "../../CompactProductCard";
import { api } from "../../../lib/api";
import type { StoreProduct } from "../../../lib/types";
import { colors, fonts } from "../../../constants/theme";
import { useCompactCards } from "./CompactCards";
import { useHomeSectionEnv, useSectionText } from "./context";
import { BandSelector, CategoryChips, DEALS_PANEL } from "./PriceBandControls";
import { SeeAllButton } from "./SeeAllButton";
import { useKeyedPages } from "./use-keyed-pages";

type Section = PriceBandDeals<StoreProduct>;

// A page is keyed "<band index>:<category id>", the category empty for All
const pageKey = (band: number, categoryId: string | null) => `${band}:${categoryId ?? ""}`;
const parseKey = (key: string) => {
  const [band, categoryId] = key.split(":");
  return { band: Number(band), categoryId: categoryId || null };
};

/** Products split into the grid's two rows, filled column by column so the first products lead both rows */
const toRows = (products: StoreProduct[]) => [products.filter((_, i) => i % 2 === 0), products.filter((_, i) => i % 2 === 1)];

/**
 * Deals under a price: bands ("Under ₹19") as the headline control, category chips beneath, and the matching
 * products in a two-row grid that scrolls sideways. Each band and chip combination loads once, when first picked.
 */
export const PriceBandDealsSection = memo(function PriceBandDealsSection({ section }: { section: Section }) {
  const { title, subtitle } = useSectionText(section);
  const { store } = useHomeSectionEnv();

  const fetchDeals = useCallback(async (key: string) => {
    const { band, categoryId } = parseKey(key);
    const res = await api.get<PriceBandPage<StoreProduct>>(
      `/api/v1/home/${store.id}/deals?sectionId=${section.id}&band=${band}${categoryId ? `&categoryId=${categoryId}` : ""}`,
    );
    return res.data;
  }, [store.id, section.id]);

  const first = useMemo<PriceBandPage<StoreProduct>>(
    () => ({ chips: section.chips, products: section.products, total: section.total }),
    [section.chips, section.products, section.total],
  );
  const { key, page, loading, select } = useKeyedPages(pageKey(0, null), first, fetchDeals);
  const { band, categoryId } = parseKey(key);
  const { products, renderCard } = useCompactCards(page.products);
  const rows = useMemo(() => toRows(products), [products]);
  const bandLabels = useMemo(() => section.bands.map((b) => b.label), [section.bands]);

  const onBand = useCallback((index: number) => select(pageKey(index, null)), [select]);
  const onChip = useCallback((id: string | null) => select(pageKey(band, id)), [select, band]);
  const onSeeAll = useCallback(() => router.push({
    pathname: "/deals/[sectionId]",
    params: { sectionId: section.id, band: String(band), ...(categoryId ? { categoryId } : {}) },
  }), [section.id, band, categoryId]);
  const seeAllLabel = `See all ${page.total.toLocaleString("en-IN")} ${bandLabels[band]?.toLowerCase() ?? ""}`;

  // The grid is bounded (one page of 20), so it's two plain rows in one scroller: a row's cards stretch to its tallest
  return (
    <View style={styles.section}>
      <View style={styles.header} accessibilityRole="header">
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {section.headline ? <Text style={styles.headline}>{section.headline}</Text> : null}
      </View>
      <BandSelector labels={bandLabels} selected={band} onSelect={onBand} />
      {page.chips.length > 0 && <CategoryChips chips={page.chips} selectedId={categoryId} onSelect={onChip} />}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        style={loading && styles.loading}
        pointerEvents={loading ? "none" : "auto"}
      >
        <View>
          {rows.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((sp) => <Fragment key={sp.id}>{renderCard(sp)}</Fragment>)}
            </View>
          ))}
        </View>
      </ScrollView>
      {page.total > products.length && <SeeAllButton onPress={onSeeAll} label={seeAllLabel} />}
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 24, paddingTop: 16, paddingBottom: 16, backgroundColor: DEALS_PANEL },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, marginBottom: 14 },
  titles: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.3, color: colors.accentText },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headline: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: "hidden", backgroundColor: colors.accent,
    fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: colors.accentText,
  },
  grid: { paddingHorizontal: 16 },
  row: { flexDirection: "row", gap: COMPACT_GAP },
  // The previous band's products stay put, faded, until the new band's arrive
  loading: { opacity: 0.4 },
});
