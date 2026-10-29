import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../constants/theme";
import type { CheckoutCreditState } from "../../lib/use-checkout-credit";
import { Coin } from "./Coin";

/** The bill line for welcome credit */
export function CheckoutCreditRow({ credit }: { credit: CheckoutCreditState }) {
  if (credit.applied <= 0) return null;
  return (
    <View style={styles.row}>
      <Coin size={22} />
      <Text style={styles.label} numberOfLines={1}>{credit.name}</Text>
      <Text style={styles.amount}>-{"₹"}{credit.applied.toFixed(0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  label: { flex: 1, fontSize: 14, color: colors.textSecondary },
  amount: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary, minWidth: 44, textAlign: "right" },
});
