import { memo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../../constants/theme";
import { FEATURED_CARD_WIDTH } from "../FeaturedProductCard";
import StoreDiscovery, { type StoreDiscoveryState } from "../store-discovery/StoreDiscovery";

interface Props {
  hasStore: boolean;
  /** First page still on its way: placeholder cards */
  loading: boolean;
  loadingMore: boolean;
  discovery: StoreDiscoveryState;
}

/** Below the sections: the first-load placeholders, the next page's spinner, or store discovery when no store is chosen */
export const HomeListFooter = memo(function HomeListFooter({ hasStore, loading, loadingMore, discovery }: Props) {
  return (
    <View>
      {hasStore && loading && (
        <View style={styles.loadingRow}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.card}>
              <View style={styles.image} />
              <View style={styles.content}>
                <View style={styles.line} />
                <View style={[styles.line, styles.lineShort]} />
              </View>
            </View>
          ))}
        </View>
      )}
      {loadingMore && <ActivityIndicator style={styles.more} color={colors.primary} />}
      {!hasStore && <StoreDiscovery discovery={discovery} />}
      <View style={styles.spacer} />
    </View>
  );
});

const styles = StyleSheet.create({
  loadingRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginTop: 24 },
  card: { width: FEATURED_CARD_WIDTH, backgroundColor: "#fff", borderRadius: 10, overflow: "hidden" },
  image: { width: "100%", height: 80, backgroundColor: "#f1f5f9" },
  content: { padding: 8, gap: 6 },
  line: { height: 12, backgroundColor: "#f1f5f9", borderRadius: 4, width: "80%" },
  lineShort: { width: "50%" },
  more: { marginTop: 24 },
  spacer: { height: 32 },
});
