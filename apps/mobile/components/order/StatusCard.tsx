import { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { formatDate } from "../../lib/i18n/format";
import { StatusStepper } from "../orders/StatusStepper";
import { ReturnStateLine } from "./ReturnStateLine";
import { awaitingPayment } from "@martly/shared/order-flow";
import { orderHeadline, orderProgress } from "./order-status";
import type { ReturnRequestData } from "../../lib/types";
import type { OrderData } from "./types";

function Timeline({ order }: { order: OrderData }) {
  const s = useStrings("orders").status;
  const labels: Record<string, string> = order.fulfillmentType === "PICKUP" ? { ...s.detail, ...s.detailPickup } : s.detail;
  const logs = [...(order.statusLogs ?? [])].reverse();
  return (
    <View style={styles.timeline}>
      {logs.map((log, i) => (
        <View key={log.id} style={styles.logRow}>
          <View style={[styles.logDot, i === 0 && styles.logDotLatest]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.logLabel, i === 0 && styles.logLabelLatest]}>{labels[log.status] ?? log.status}</Text>
            {log.note ? <Text style={styles.logNote}>{log.note}</Text> : null}
          </View>
          <Text style={styles.logTime}>{formatDate(log.createdAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text>
        </View>
      ))}
    </View>
  );
}

/** Rider and live map while the order is on its way */
function OnTheWay({ order }: { order: OrderData }) {
  const router = useRouter();
  const t = useStrings("orders").detail;
  const rider = order.deliveryTrip?.rider;
  if (order.status !== "OUT_FOR_DELIVERY" || !order.deliveryTripId) return null;
  return (
    <View style={styles.onTheWay}>
      {rider?.name ? (
        <View style={styles.riderRow}>
          <View style={styles.riderIcon}><Ionicons name="bicycle" size={18} color={colors.primary} /></View>
          <Text style={styles.riderText} numberOfLines={1}>{t.riderOnTheWay(rider.name)}</Text>
          {rider.phone ? (
            <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${rider.phone}`)} accessibilityLabel={t.callRider}>
              <Ionicons name="call" size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <TouchableOpacity style={styles.trackBtn} onPress={() => router.push({ pathname: "/live-tracking", params: { orderId: order.id } })} activeOpacity={0.8}>
        <Ionicons name="navigate" size={18} color="#fff" />
        <Text style={styles.trackText}>{t.trackRider}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function StatusCard({ order, returnRequest }: { order: OrderData; returnRequest: ReturnRequestData | null }) {
  const t = useStrings("orders").detail;
  const [showUpdates, setShowUpdates] = useState(false);
  const { title, sub } = orderHeadline(order);
  const { labels, current } = orderProgress(order);
  const first = order.items[0];
  const thumb = first?.variant?.imageUrl || first?.product.imageUrl;
  const cancelled = order.status === "CANCELLED";
  const unpaid = awaitingPayment(order);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, cancelled && styles.titleCancelled, unpaid && styles.titleUnpaid]}>{title}</Text>
          <Text style={styles.sub}>{sub}</Text>
          {returnRequest ? <View style={styles.returnLine}><ReturnStateLine request={returnRequest} /></View> : null}
        </View>
        {thumb ? <View style={styles.thumb}><Image source={{ uri: thumb }} style={styles.thumbImg} /></View> : null}
      </View>
      {!cancelled && !unpaid && <View style={styles.stepper}><StatusStepper steps={labels} current={current} /></View>}
      <OnTheWay order={order} />
      {(order.statusLogs?.length ?? 0) > 0 && (
        <TouchableOpacity style={styles.toggle} onPress={() => setShowUpdates((v) => !v)} activeOpacity={0.7}>
          <Text style={styles.toggleText}>{showUpdates ? t.hideUpdates : t.seeUpdates}</Text>
          <Ionicons name={showUpdates ? "chevron-up" : "chevron-down"} size={18} color={colors.text} />
        </TouchableOpacity>
      )}
      {showUpdates && <Timeline order={order} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginHorizontal: 16, marginTop: 16, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 4 },
  title: { fontSize: 22, lineHeight: 28, fontFamily: fonts.extrabold, color: colors.text },
  titleCancelled: { color: "#b91c1c" },
  titleUnpaid: { color: "#b45309" },
  returnLine: { marginTop: 6 },
  sub: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },
  thumb: { width: 60, height: 60, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  thumbImg: { width: 50, height: 50, resizeMode: "contain" },
  stepper: { paddingBottom: 14, marginHorizontal: -4 },
  onTheWay: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  riderRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#f0fdfa", borderRadius: 12, padding: 10 },
  riderIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  riderText: { flex: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#ccfbf1" },
  trackBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 24, minHeight: 46 },
  trackText: { fontSize: 15, fontFamily: fonts.bold, color: "#fff" },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, minHeight: 50 },
  toggleText: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  timeline: { paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  logRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  logDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: 5 },
  logDotLatest: { backgroundColor: colors.primary },
  logLabel: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary },
  logLabelLatest: { fontFamily: fonts.bold, color: colors.text },
  logNote: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 1 },
  logTime: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.textSecondary },
});
