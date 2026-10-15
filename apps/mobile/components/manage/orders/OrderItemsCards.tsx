import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { StatusPill } from "../ui/StatusPill";
import { ORDER_STATUS, PAYMENT_STATUS, formatINR, manage, tabular } from "../ui/tokens";
import { formatDate } from "../ui/dates";
import type { OrderDetail } from "./types";

export function ItemsCard({ order }: { order: OrderDetail }) {
  return (
    <SectionCard title={`Items · ${order.items.length}`} flush>
      {order.items.map((item) => {
        const image = item.variant.imageUrl ?? item.product.imageUrl ?? item.product.images[0];
        return (
          <View key={item.id} style={styles.item}>
            {image ? <Image source={{ uri: image }} style={styles.thumb} /> : (
              <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="image-outline" size={18} color={manage.muted} /></View>
            )}
            <View style={styles.itemBody}>
              <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
              <Text style={styles.itemMeta}>{item.variant.name} · {item.quantity} × {formatINR(Number(item.unitPrice))}</Text>
            </View>
            <Text style={[styles.itemTotal, tabular]}>{formatINR(Number(item.totalPrice))}</Text>
          </View>
        );
      })}
    </SectionCard>
  );
}

function amountDue(order: OrderDetail, deductions: number): number {
  return order.paymentStatus === "PAID" ? 0 : Math.max(0, Number(order.totalAmount) - deductions);
}

export function PaymentBreakdown({ order }: { order: OrderDetail }) {
  const subtotal = order.items.reduce((sum, i) => sum + Number(i.totalPrice), 0);
  const coupon = Number(order.couponDiscount ?? 0);
  const fee = Number(order.deliveryFee ?? 0);
  const wallet = Number(order.walletAmountUsed ?? 0);
  const loyalty = order.loyaltyPointsUsed ?? 0;
  const payment = PAYMENT_STATUS[order.paymentStatus] ?? { label: order.paymentStatus, color: "#475569", bg: "#f1f5f9" };

  return (
    <SectionCard title="Payment">
      <View style={styles.payHead}>
        <Text style={styles.method}>{order.paymentMethod === "COD" ? "Cash on delivery" : "Online payment"}</Text>
        <StatusPill {...payment} />
      </View>
      <KeyValue label="Items subtotal" value={formatINR(subtotal)} />
      {coupon > 0 ? <KeyValue label={`Coupon ${order.couponCode ?? ""}`.trim()} value={`−${formatINR(coupon)}`} valueColor="#15803d" /> : null}
      {fee > 0 ? <KeyValue label="Delivery fee" value={formatINR(fee)} /> : null}
      <KeyValue label="Order total" value={formatINR(Number(order.totalAmount))} emphasis />
      {wallet > 0 ? <KeyValue label="Wallet" value={`−${formatINR(wallet)}`} valueColor="#15803d" /> : null}
      {loyalty > 0 ? <KeyValue label={`Loyalty (${loyalty} pts)`} value={`−${formatINR(loyalty)}`} valueColor="#b45309" /> : null}
      <KeyValue label="Amount due" value={formatINR(amountDue(order, wallet + loyalty))} emphasis />
      {order.razorpayPaymentId ? <KeyValue label="Razorpay ID" value={order.razorpayPaymentId} /> : null}
      {order.loyaltyPointsEarned ? <KeyValue label="Loyalty earned" value={`+${order.loyaltyPointsEarned} pts`} /> : null}
    </SectionCard>
  );
}

export function TimelineCard({ order }: { order: OrderDetail }) {
  return (
    <SectionCard title="Status history">
      {order.statusLogs.map((log, i) => {
        const cfg = ORDER_STATUS[log.status];
        const last = i === order.statusLogs.length - 1;
        return (
          <View key={log.id} style={styles.logRow}>
            <View style={styles.logRail}>
              <View style={[styles.logDot, { backgroundColor: cfg?.color ?? manage.muted }]} />
              {!last && <View style={styles.logLine} />}
            </View>
            <View style={styles.logBody}>
              <Text style={styles.logStatus}>{cfg?.label ?? log.status}</Text>
              {log.note ? <Text style={styles.logNote}>{log.note}</Text> : null}
              <Text style={styles.logTime}>{formatDate(log.createdAt, true)}</Text>
            </View>
          </View>
        );
      })}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  thumb: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: manage.canvas },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  itemBody: { flex: 1, minWidth: 0 },
  itemName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  itemMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  itemTotal: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  payHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  method: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  logRow: { flexDirection: "row", gap: 12 },
  logRail: { alignItems: "center", width: 12 },
  logDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  logLine: { flex: 1, width: 2, backgroundColor: manage.line, marginVertical: 2 },
  logBody: { flex: 1, paddingBottom: 14 },
  logStatus: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  logNote: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  logTime: { fontFamily: fonts.medium, fontSize: 12, color: manage.muted, marginTop: 2 },
});
