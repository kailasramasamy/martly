import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useAuth } from "../../lib/auth-context";
import { useRewardsSummary } from "../../lib/use-rewards-summary";
import { useStrings } from "../../lib/i18n/use-strings";

const inr = (n: number) => `₹${Math.floor(n).toLocaleString("en-IN")}`;

/** Above the bill: money and points waiting to be used, at the moment the shopper decides; hidden when there's none */
export function RewardsReminder({ storeId }: { storeId: string | undefined }) {
  const { isAuthenticated } = useAuth();
  const t = useStrings("checkout").rewards;
  const { wallet, points } = useRewardsSummary(isAuthenticated, storeId);
  if (wallet <= 0 && points <= 0) return null;

  const parts = [wallet > 0 ? t.wallet(inr(wallet)) : null, points > 0 ? t.points(points.toLocaleString("en-IN")) : null].filter(Boolean);
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(wallet > 0 ? "/wallet" : "/loyalty")}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <Ionicons name={wallet > 0 ? "wallet" : "star"} size={18} color={wallet > 0 ? colors.primary : "#d97706"} />
      <Text style={styles.text}>
        <Text style={styles.strong}>{parts.join(" + ")}</Text>{t.availableApply}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10,
    marginHorizontal: 16, marginTop: 16, borderRadius: 12, backgroundColor: colors.primary + "0D",
    borderWidth: 1, borderColor: colors.primary + "26",
  },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  strong: { fontFamily: fonts.bold, color: colors.primary },
});
