import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CreditGrantView } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { daysLeft, rupees } from "../../lib/credit-copy";
import { Coin } from "./Coin";

interface Props {
  grants: CreditGrantView[];
  /** The cart's items total; when it is below a credit's minimum the strip says how much more to add */
  itemTotal?: number;
}

/** A reminder that welcome credit is waiting: all of it, with the soonest expiry, or what the cart still needs for the next one */
export function CreditStrip({ grants, itemTotal }: Props) {
  const t = useStrings("credits").reminder;
  const router = useRouter();
  const locked = itemTotal ? grants.filter((g) => itemTotal < g.minOrderAmount).sort((a, b) => a.minOrderAmount - b.minOrderAmount)[0] : undefined;
  const total = grants.reduce((sum, g) => sum + g.amount, 0);
  const days = Math.min(...grants.map((g) => daysLeft(g.expiresAt)));
  const applied = itemTotal ? grants.filter((g) => itemTotal >= g.minOrderAmount).reduce((sum, g) => sum + g.amount, 0) : 0;
  const text = !locked || !itemTotal
    ? `${t.toSpend(rupees(total))} · ${t.daysLeft(days)}`
    : applied > 0
      ? t.partial(rupees(applied), rupees(locked.minOrderAmount - itemTotal), rupees(locked.amount))
      : t.addMore(rupees(locked.minOrderAmount - itemTotal), rupees(locked.amount));

  return (
    <TouchableOpacity style={styles.strip} activeOpacity={0.85} onPress={() => router.push("/wallet")} accessibilityRole="button" accessibilityLabel={text}>
      <Coin size={26} />
      <Text style={styles.text} numberOfLines={2}>{text}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.accentText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fde68a",
  },
  text: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.accentText },
});
