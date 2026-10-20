import { memo, useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { HomeTab, TabbedRowSection as TabbedRow } from "@martly/shared/types";
import { HOME_ROW_MAX_PRODUCTS, TabRailStyle } from "@martly/shared/constants";
import { ProductList } from "../../ProductList";
import { api } from "../../../lib/api";
import { useStrings } from "../../../lib/i18n/use-strings";
import type { StoreProduct } from "../../../lib/types";
import { openCollection, useHomeSectionEnv, useSectionText } from "./context";
import { SectionHeader } from "./SectionHeader";
import { SeeAllButton } from "./SeeAllButton";
import { TabRail } from "./TabRail";
import { useKeyedPages } from "./use-keyed-pages";

type TabPage = { products: StoreProduct[]; total: number };

const DEFAULT_TINT = "#e6f4f1";

/** A collection rail switched between collections by a tab rail; each tab loads once, when first picked */
export const TabbedRowSection = memo(function TabbedRowSection({ section }: { section: TabbedRow<StoreProduct> }) {
  const t = useStrings("home");
  const { title, subtitle } = useSectionText(section);
  const { store } = useHomeSectionEnv();
  const { tabs } = section;
  const tabById = useMemo(() => new Map(tabs.map((t) => [t.id, t])), [tabs]);

  const fetchTab = useCallback(async (tabId: string): Promise<TabPage> => {
    const collectionId = tabById.get(tabId)!.collectionId;
    const res = await api.getList<StoreProduct>(
      `/api/v1/collections/${collectionId}/products?storeId=${store.id}&page=1&pageSize=${HOME_ROW_MAX_PRODUCTS}`,
    );
    return { products: res.data, total: res.meta.total };
  }, [tabById, store.id]);

  const first = useMemo(() => ({ products: section.products, total: section.total }), [section.products, section.total]);
  const { key, page, loading, select } = useKeyedPages(tabs[0].id, first, fetchTab);
  const onSelect = useCallback((tab: HomeTab) => select(tab.id), [select]);

  const collectionId = tabById.get(key)!.collectionId;
  const onSeeAll = useCallback(() => openCollection(collectionId), [collectionId]);

  const tint = section.tint ?? DEFAULT_TINT;
  // Icon-card tabs hang above the panel like folder tabs, the picked one in the panel's colour; the other looks sit inside it
  const folder = section.tabStyle === TabRailStyle.ICON_CARD;
  const rail = tabs.length > 1
    ? <TabRail tabs={tabs} look={section.tabStyle} tint={tint} selectedId={key} onSelect={onSelect} />
    : null;

  return (
    <View style={styles.section}>
      <SectionHeader title={title} subtitle={subtitle} />
      {folder && rail}
      <View style={[styles.panel, { backgroundColor: tint }, !(folder && rail) && styles.panelOpen]}>
        {!folder && rail}
        <View style={loading && styles.loading} pointerEvents={loading ? "none" : "auto"}>
          <ProductList products={page.products} layout="rail" elevated contentContainerStyle={styles.rail} />
        </View>
        <SeeAllButton onPress={onSeeAll} label={page.total > 0 ? t.seeAllProducts(page.total) : undefined} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  panel: { paddingTop: 10, paddingBottom: 12 },
  panelOpen: { paddingTop: 12 },
  // Room under the raised cards so their shadow isn't clipped by the rail
  rail: { paddingBottom: 8 },
  // The previous tab's products stay put, faded, until the new tab's arrive
  loading: { opacity: 0.4 },
});
