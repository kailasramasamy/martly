import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LISTING_FEE } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";
import { useEntitlements } from "../marketing/use-entitlements";

/** How many of the plan's own-product listings are used, with extra ones bought, and a way to buy more */
export function ListingsMeter() {
  const router = useRouter();
  const { data } = useEntitlements();
  if (!data) return null;
  const { included, used, planLeft, extraBalance, unlimited } = data.listings;
  const empty = !unlimited && planLeft + extraBalance <= 0;
  const share = unlimited || included === 0 ? 1 : Math.min(1, used / included);
  const caption = unlimited
    ? "Unlimited listings, set by Martly"
    : `${extraBalance} extra listing${extraBalance === 1 ? "" : "s"} · then ₹${LISTING_FEE} each`;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.label}>Your own products</Text>
        <Text style={[styles.count, tabular]}>{unlimited ? `${used} listed` : `${Math.min(used, included)} of ${included} free used`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${share * 100}%` }, empty && styles.fillEmpty, unlimited && styles.fillUnlimited]} />
      </View>
      <View style={styles.foot}>
        <Text style={[styles.caption, empty && styles.warn]}>{empty ? "No listings left. Buy more to add products." : caption}</Text>
        {!unlimited && (
          <TouchableOpacity onPress={() => router.push("/manage/marketing-plan")} hitSlop={12} accessibilityRole="button">
            <Text style={styles.buy}>Buy more</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  count: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  track: { height: 6, borderRadius: 3, backgroundColor: manage.line, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  fillEmpty: { backgroundColor: manage.attention },
  fillUnlimited: { backgroundColor: "#99f6e4" },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 24 },
  caption: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  warn: { color: colors.text, fontFamily: fonts.semibold },
  buy: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
