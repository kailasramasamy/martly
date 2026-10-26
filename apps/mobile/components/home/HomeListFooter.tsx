import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Loader } from "../Loader";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { FEATURED_CARD_WIDTH } from "../FeaturedProductCard";
import { HomeSignOff } from "./HomeSignOff";

interface Props {
  hasStore: boolean;
  /** First page still on its way: placeholder cards */
  loading: boolean;
  loadingMore: boolean;
  /** Every section is on screen: the sign-off closes the page */
  reachedEnd: boolean;
}

/** Below the sections: the first-load placeholders, the next page's spinner, the sign-off once every section is in, or
 * a coming-soon note when no store is live anywhere yet */
export const HomeListFooter = memo(function HomeListFooter({ hasStore, loading, loadingMore, reachedEnd }: Props) {
  const t = useStrings("home");
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
      {loadingMore && <Loader style={styles.more} />}
      {hasStore && reachedEnd && <HomeSignOff />}
      {!hasStore && (
        <View style={styles.empty}>
          <Ionicons name="storefront-outline" size={40} color={colors.primary} />
          <Text style={styles.emptyTitle}>{t.noStoresYet}</Text>
          <Text style={styles.emptyText}>{t.comingSoon}</Text>
        </View>
      )}
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
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: 8 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
