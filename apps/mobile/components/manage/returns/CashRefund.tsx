import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, radius } from "../../../constants/theme";
import { formatINR } from "../ui/tokens";
import type { ReturnRequestDetail } from "./types";

/** Cash the store pays at the counter when the customer drops the item off; 0 for any other refund */
export function cashDueAtStore(r: ReturnRequestDetail): number {
  return r.remedy === "REFUND" && r.refundTo === "CASH" && r.method === "AT_STORE" ? Number(r.approvedAmount ?? 0) : 0;
}

export function receiveMessage(r: ReturnRequestDetail, cashDue: number): string {
  if (r.remedy !== "REFUND") return "The item is back with the store.";
  if (cashDue > 0) return `The item is back with the store. Confirm you paid ${formatINR(cashDue)} cash to the customer.`;
  return "The item is back with the store. The refund is paid to the customer's wallet now.";
}

export function CashRefundBanner({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return (
    <View style={styles.cash}>
      <Text style={styles.label}>Pay {formatINR(amount)} cash to the customer</Text>
      <Text style={styles.note}>Hand it over at the counter, then mark the item received.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cash: { gap: 2, padding: 14, borderRadius: radius.lg, backgroundColor: colors.primary },
  label: { fontFamily: fonts.extrabold, fontSize: 18, color: "#fff" },
  note: { fontFamily: fonts.medium, fontSize: 13, color: "#d1fae5" },
});
