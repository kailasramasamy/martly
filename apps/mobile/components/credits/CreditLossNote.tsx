import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { rupees, useCreditCopy } from "../../lib/credit-copy";
import type { CheckoutCreditState } from "../../lib/use-checkout-credit";

/** Above Place order: welcome credit this order leaves unused, which a later order can't use */
export function CreditLossNote({ credit, orderAmount }: { credit: CheckoutCreditState; orderAmount: number }) {
  const t = useStrings("credits").checkout;
  const copy = useCreditCopy();
  const { lost } = credit;
  if (lost.length === 0) return null;
  const only = lost.length === 1 && orderAmount < lost[0].minOrderAmount ? lost[0] : null;
  const text = only
    ? t.loseShort(rupees(only.minOrderAmount - orderAmount), rupees(only.amount), copy.name(only))
    : t.lose(rupees(lost.reduce((sum, g) => sum + g.amount, 0)));

  return (
    <View style={styles.note}>
      <Ionicons name="alert-circle" size={18} color={colors.accentText} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fde68a",
  },
  text: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.accentText },
});
