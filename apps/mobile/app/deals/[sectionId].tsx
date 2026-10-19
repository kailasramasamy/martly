import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStore } from "../../lib/store-context";
import { ProductActionsProvider } from "../../lib/product-actions";
import { useDealsFeed } from "../../lib/use-deals-feed";
import { ProductList } from "../../components/ProductList";
import { FloatingCart } from "../../components/FloatingCart";
import { BandSelector, CategoryChips, DEALS_PANEL } from "../../components/home/sections/PriceBandControls";

function Message({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.message}>
      <Ionicons name={icon} size={28} color={colors.textSecondary} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

/**
 * Every product of a Home price-band deals section, opened from its "See all": the same amber band track and chips
 * as the Home panel, held above a 3-column grid that loads as it scrolls.
 */
export default function DealsScreen() {
  const params = useLocalSearchParams<{ sectionId: string; band?: string; categoryId?: string }>();
  const { selectedStore } = useStore();
  const navigation = useNavigation();
  const [band, setBand] = useState(Number(params.band ?? 0));
  const [categoryId, setCategoryId] = useState<string | null>(params.categoryId || null);
  const feed = useDealsFeed(selectedStore?.id, params.sectionId, band, categoryId);

  const title = feed.section?.title;
  useEffect(() => { if (title) navigation.setOptions({ title }); }, [navigation, title]);

  const labels = useMemo(() => feed.section?.bands.map((b) => b.label) ?? [], [feed.section]);
  const onBand = useCallback((index: number) => { setBand(index); setCategoryId(null); }, []);

  if (feed.loading && !feed.section) return <ActivityIndicator style={styles.spinner} color={colors.primary} />;
  if (feed.failed || !feed.section) return <Message icon="cloud-offline-outline" text="These deals aren't available right now." />;

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={styles.container}>
        <View style={styles.panel}>
          <BandSelector labels={labels} selected={band} onSelect={onBand} />
          {feed.chips.length > 0 && <CategoryChips chips={feed.chips} selectedId={categoryId} onSelect={setCategoryId} />}
          <Text style={styles.count}>
            {feed.loading ? " " : `${feed.total.toLocaleString("en-IN")} products ${labels[band]?.toLowerCase() ?? ""}`}
          </Text>
        </View>
        <ProductList
          products={feed.products}
          layout="grid"
          numColumns={3}
          contentContainerStyle={styles.grid}
          style={feed.loading && styles.loading}
          onEndReached={feed.loadMore}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={feed.loading ? null : <Message icon="basket-outline" text="Nothing in this price band right now" />}
          ListFooterComponent={feed.loadingMore ? <ActivityIndicator style={styles.more} color={colors.primary} /> : null}
        />
        <FloatingCart />
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  panel: { paddingTop: 12, backgroundColor: DEALS_PANEL, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  count: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentText, paddingHorizontal: 16, paddingBottom: 12, opacity: 0.75 },
  grid: { paddingTop: 12, paddingBottom: 120 },
  // The previous band's products stay put, faded, until the new band's arrive
  loading: { opacity: 0.4 },
  spinner: { marginTop: 48 },
  more: { marginVertical: 16 },
  message: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32, gap: 10 },
  messageText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
});
