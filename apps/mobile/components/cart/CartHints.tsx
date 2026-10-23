import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CouponOffer } from "@martly/shared/types";
import { useCart } from "../../lib/cart-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { CartReview } from "../../lib/types";
import { colors, fonts } from "../../constants/theme";

const rupees = (n: number) => Math.round(n).toLocaleString("en-IN");

/**
 * The coupon worth knowing about: one that applies now (Apply saves it for checkout, as a coupon from Home does),
 * else the nearest one to unlock; hidden without one in reach
 */
export function CouponHint({ coupon }: { coupon: CouponOffer | null }) {
  const t = useStrings("cart");
  const { pendingCoupon, setPendingCoupon } = useCart();
  if (!coupon) return null;
  // Saved for checkout and still good for this cart; below its minimum it shows what's missing instead
  const applied = pendingCoupon === coupon.code && coupon.eligible;

  return (
    <View style={styles.row}>
      <Ionicons name={applied ? "checkmark-circle" : "pricetag"} size={18} color={colors.primary} />
      <Text style={styles.text}>
        {applied
          ? t.couponApplied(coupon.code)
          : coupon.eligible
            ? t.couponApplies(coupon.code, rupees(coupon.discount ?? 0))
            : t.couponLocked(rupees(coupon.shortBy ?? 0), coupon.code, coupon.title)}
      </Text>
      {coupon.eligible && !applied && (
        <TouchableOpacity style={styles.apply} onPress={() => setPendingCoupon(coupon.code)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button">
          <Text style={styles.applyText}>{t.apply}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** For a shopper paying for delivery who isn't a member: the plan that would make it free */
export function PlusHint({ offer }: { offer: CartReview["plusOffer"] }) {
  const t = useStrings("cart");
  if (!offer) return null;

  return (
    <TouchableOpacity style={[styles.row, styles.plusRow]} onPress={() => router.push("/membership")} accessibilityRole="button" activeOpacity={0.7}>
      <Ionicons name="star" size={18} color="#7c3aed" />
      <Text style={styles.text}>{t.plusHint(offer.name, rupees(offer.price), t.per[offer.duration])}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 12, borderRadius: 12, backgroundColor: colors.primary + "0D", borderWidth: 1, borderColor: colors.primary + "26",
  },
  plusRow: { backgroundColor: "#7c3aed0D", borderColor: "#7c3aed26" },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
  apply: { minHeight: 32, justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primary },
  applyText: { fontFamily: fonts.bold, fontSize: 13, color: "#fff" },
});
