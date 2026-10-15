import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, radius } from "../../../constants/theme";
import { formatINR, manage, tabular } from "../ui/tokens";
import type { StoreProductDraft } from "./draft";

function effectivePrice(d: StoreProductDraft): number | null {
  const price = Number(d.price);
  if (!(price > 0)) return null;
  const value = Number(d.discountValue);
  if (d.discountMode === "NONE" || !(value > 0)) return price;
  const off = d.discountMode === "FLAT" ? value : (price * value) / 100;
  return Math.max(0, price - off);
}

/** Live "customers pay" line so the manager sees the outcome of price + discount before saving */
export function PricePreview({ draft }: { draft: StoreProductDraft }) {
  const price = Number(draft.price);
  const pay = effectivePrice(draft);
  if (pay === null) return null;
  const discounted = pay < price;
  return (
    <View style={styles.box}>
      <Text style={styles.label}>Customers pay</Text>
      <View style={styles.figures}>
        {discounted && <Text style={[styles.was, tabular]}>{formatINR(price, { decimals: true })}</Text>}
        <Text style={[styles.pay, tabular]}>{formatINR(pay, { decimals: true })}</Text>
        {discounted && <Text style={styles.off}>{Math.round(((price - pay) / price) * 100)}% off</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, height: 48, borderRadius: radius.lg, backgroundColor: manage.tint,
  },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primaryDark },
  figures: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  was: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, textDecorationLine: "line-through" },
  pay: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  off: { fontFamily: fonts.bold, fontSize: 12, color: "#15803d" },
});
