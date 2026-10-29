import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { formatDate } from "../../lib/i18n/format";
import { rupees, slotLabel } from "../orders/format";
import type { OrderData } from "./types";

const PAYMENT_TONE: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: "#fef3c7", fg: "#92400e" },
  PAID: { bg: "#dcfce7", fg: "#15803d" },
  FAILED: { bg: "#fee2e2", fg: "#b91c1c" },
  REFUNDED: { bg: "#dbeafe", fg: "#1d4ed8" },
};

function Row({ label, value, strong, tone }: { label: ReactNode; value: string; strong?: boolean; tone?: "saving" }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.value, strong && styles.strong, tone === "saving" && styles.saving]}>{value}</Text>
    </View>
  );
}

function Bill({ order }: { order: OrderData }) {
  const t = useStrings("orders").detail;
  const common = useStrings("common");
  const welcomeCredit = useStrings("credits").orderLine;
  const pickup = order.fulfillmentType === "PICKUP";
  const fee = Number(order.deliveryFee ?? 0);
  const coupon = Number(order.couponDiscount ?? 0);
  const credit = Number(order.creditDiscount ?? 0);
  const refused = Number(order.refusedAmount ?? 0);
  return (
    <View style={styles.group}>
      <Row label={t.itemsSubtotal} value={rupees(Number(order.totalAmount) + coupon + credit - fee)} />
      <Row label={pickup ? t.fulfillment : t.deliveryFee} value={pickup ? t.storePickupFree : fee > 0 ? rupees(fee) : common.free} tone={fee > 0 ? undefined : "saving"} />
      {coupon > 0 && <Row label={t.coupon(order.couponCode ?? "")} value={`−${rupees(coupon)}`} tone="saving" />}
      {credit > 0 && <Row label={welcomeCredit} value={`−${rupees(credit)}`} tone="saving" />}
      <Row label={t.orderTotal} value={rupees(order.totalAmount)} strong />
      {refused > 0 && <Row label={order.paymentMethod === "COD" ? t.handedBackCod : t.handedBackOnline} value={`−${rupees(refused)}`} tone="saving" />}
    </View>
  );
}

function PaidWith({ order }: { order: OrderData }) {
  const t = useStrings("orders").detail;
  const payment = useStrings("orders").status.payment as Record<string, string>;
  const wallet = Number(order.walletAmountUsed ?? 0);
  const points = order.loyaltyPointsUsed ?? 0;
  const cashRefused = order.paymentMethod === "COD" ? Number(order.refusedAmount ?? 0) : 0;
  const rest = Number(order.totalAmount) - wallet - points - cashRefused;
  const tone = PAYMENT_TONE[order.paymentStatus] ?? { bg: "#f1f5f9", fg: "#475569" };
  return (
    <View style={styles.group}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{t.paidWith}</Text>
        <View style={[styles.pill, { backgroundColor: tone.bg }]}><Text style={[styles.pillText, { color: tone.fg }]}>{payment[order.paymentStatus] ?? order.paymentStatus}</Text></View>
      </View>
      {points > 0 && <Row label={t.loyaltyPoints} value={rupees(points)} />}
      {wallet > 0 && <Row label={t.martlyWallet} value={rupees(wallet)} />}
      {rest > 0 && <Row label={order.paymentMethod === "COD" ? t.cod : t.online} value={rupees(rest)} />}
    </View>
  );
}

function Destination({ order }: { order: OrderData }) {
  const t = useStrings("orders").detail;
  const pickup = order.fulfillmentType === "PICKUP";
  const slot = slotLabel({ scheduledDate: order.scheduledDate ?? null, slotStartTime: order.slotStartTime ?? null, slotEndTime: order.slotEndTime ?? null });
  return (
    <View style={styles.group}>
      <Text style={styles.heading}>{pickup ? t.pickupFrom : t.deliverTo}</Text>
      <Text style={styles.body}>{order.deliveryAddress ?? "—"}</Text>
      {slot ? <Text style={styles.meta}>{pickup ? t.scheduledPickup : t.scheduledDelivery} · {slot}</Text> : null}
      {order.deliveryNotes ? <Text style={styles.meta}>{pickup ? t.pickupNotes(order.deliveryNotes) : t.notes(order.deliveryNotes)}</Text> : null}
    </View>
  );
}

export function OrderSummaryCard({ order }: { order: OrderData }) {
  const t = useStrings("orders").detail;
  const earned = order.loyaltyPointsEarned ?? 0;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t.orderSummary}</Text>
      <View style={styles.group}>
        <Row label={t.orderPlaced} value={formatDate(order.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })} />
        <Row label={t.orderNumber} value={`#${order.id.slice(0, 8).toUpperCase()}`} />
      </View>
      <Bill order={order} />
      <PaidWith order={order} />
      <Destination order={order} />
      {earned > 0 && (
        <View style={styles.earned}>
          <Ionicons name="star" size={15} color="#d97706" />
          <Text style={styles.earnedText}>{t.loyaltyEarned(earned)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginHorizontal: 16, marginTop: 12, padding: 16 },
  title: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.text, marginBottom: 4 },
  group: { gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  label: { flex: 1, fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary },
  value: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, fontVariant: ["tabular-nums"] },
  strong: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text },
  saving: { color: "#15803d" },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11.5, fontFamily: fonts.bold },
  body: { fontSize: 14, lineHeight: 20, fontFamily: fonts.regular, color: colors.text },
  meta: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  earned: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 12 },
  earnedText: { fontSize: 13.5, fontFamily: fonts.semibold, color: "#92400e" },
});
