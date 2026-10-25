import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Loader } from "../components/Loader";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { useStore } from "../lib/store-context";
import { useStrings } from "../lib/i18n/use-strings";
import { ProductActionsProvider } from "../lib/product-actions";
import { useBuyGetFeed } from "../lib/use-buy-get-feed";
import { ProductList } from "../components/ProductList";
import { FloatingCart } from "../components/FloatingCart";
import { CategoryChips } from "../components/home/sections/PriceBandControls";
import { BUY_GET_SHELF } from "../components/home/sections/BuyGetDealsSection";

function Message({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.message}>
      <Ionicons name={icon} size={28} color={colors.textSecondary} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

/** Every buy X get Y offer at the store, opened from the Home row: category chips over a 3-column grid that loads as it scrolls */
export default function BuyGetScreen() {
  const { selectedStore } = useStore();
  const t = useStrings("home");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const feed = useBuyGetFeed(selectedStore?.id, categoryId);

  if (feed.loading && !feed.first) return <Loader style={styles.spinner} />;
  if (feed.failed && !feed.first) return <Message icon="cloud-offline-outline" text={t.buyGetUnavailable} />;

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={styles.container}>
        <View style={styles.panel}>
          {feed.chips.length > 1 && <CategoryChips chips={feed.chips} selectedId={categoryId} onSelect={setCategoryId} />}
          <View style={styles.countRow}>
            <Ionicons name="gift" size={13} color={colors.primary} />
            <Text style={styles.count}>{feed.loading ? " " : t.buyGetCount(feed.total)}</Text>
          </View>
        </View>
        <ProductList
          products={feed.products}
          layout="grid"
          numColumns={3}
          contentContainerStyle={styles.grid}
          style={feed.loading && styles.loading}
          onEndReached={feed.loadMore}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={feed.loading ? null : <Message icon="gift-outline" text={t.buyGetEmpty} />}
          ListFooterComponent={feed.loadingMore ? <Loader style={styles.more} /> : null}
        />
        <FloatingCart />
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  panel: { paddingTop: 12, backgroundColor: BUY_GET_SHELF, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  countRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingBottom: 12 },
  count: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primaryDark },
  grid: { paddingTop: 12, paddingBottom: 120 },
  // The previous chip's products stay put, faded, until the new chip's arrive
  loading: { opacity: 0.4 },
  spinner: { marginTop: 48 },
  more: { marginVertical: 16 },
  message: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32, gap: 10 },
  messageText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
});
