import { View, Text, StyleSheet } from "react-native";
import { amount } from "../../lib/money";
import { Ionicons } from "@expo/vector-icons";
import { useStrings } from "../../lib/i18n/use-strings";
import { colors, spacing, fontSize } from "../../constants/theme";

interface CartBillProps {
  itemTotal: number;
  /** The store's lowest tier fee; the exact fee comes from the address at checkout. null: not known yet */
  deliveryFee: number | null;
  freeDelivery: boolean;
  memberFreeDelivery: boolean;
  /** The applied coupon and what it takes off, when it applies to this cart */
  coupon: { code: string; amount: number } | null;
  /** Welcome credit checkout will take off, by its name */
  credit: { name: string; amount: number } | null;
  grandTotal: number;
  savings: number;
}

export function CartBill({ itemTotal, deliveryFee, freeDelivery, memberFreeDelivery, coupon, credit, grandTotal, savings }: CartBillProps) {
  const t = useStrings("cart");
  const common = useStrings("common");

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t.billDetails}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>{t.itemTotal}</Text>
          <Text style={styles.value}>{"\u20B9"}{amount(itemTotal)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t.deliveryFee}</Text>
          {freeDelivery ? (
            <View style={styles.freeTag}>
              <Text style={styles.free}>{common.free}</Text>
              {memberFreeDelivery && (
                <View style={styles.memberBadge}>
                  <Ionicons name="star" size={10} color="#7c3aed" />
                  <Text style={styles.memberBadgeText}>{t.plus}</Text>
                </View>
              )}
            </View>
          ) : deliveryFee != null ? (
            <Text style={styles.value}>{t.deliveryFrom(amount(deliveryFee))}</Text>
          ) : (
            <Text style={styles.label}>{t.atCheckout}</Text>
          )}
        </View>
        {coupon && (
          <View style={styles.row}>
            <Text style={styles.label}>{t.couponLine(coupon.code)}</Text>
            <Text style={styles.free}>-{"\u20B9"}{amount(coupon.amount)}</Text>
          </View>
        )}
        {credit && (
          <View style={styles.row}>
            <Text style={styles.label}>{credit.name}</Text>
            <Text style={styles.free}>-{"\u20B9"}{credit.amount.toFixed(0)}</Text>
          </View>
        )}
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.grand}>{t.grandTotal}</Text>
          <Text style={styles.grand}>{"\u20B9"}{amount(grandTotal)}</Text>
        </View>
        {savings >= 1 && (
          <View style={styles.savings}>
            <Ionicons name="pricetag" size={14} color={colors.primary} />
            <Text style={styles.savingsLabel}>{t.savings}</Text>
            <Text style={styles.savingsValue}>{"\u20B9"}{amount(savings)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.sm, paddingBottom: spacing.md },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  label: { fontSize: fontSize.md, color: colors.textSecondary },
  value: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  freeTag: { flexDirection: "row", alignItems: "center", gap: 6 },
  free: { fontSize: fontSize.md, fontWeight: "600", color: colors.primary },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#7c3aed14",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  memberBadgeText: { fontSize: 10, fontWeight: "700", color: "#7c3aed" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  grand: { fontSize: 15, fontWeight: "700", color: colors.text },
  savings: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary + "0D",
  },
  savingsLabel: { flex: 1, fontSize: fontSize.md, fontWeight: "600", color: colors.primary },
  savingsValue: { fontSize: fontSize.md, fontWeight: "700", color: colors.primary },
});
