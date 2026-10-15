import { View, Text, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { StatusPill } from "../ui/StatusPill";
import { ORDER_STATUS, manage } from "../ui/tokens";
import { formatDate, timeAgo } from "../ui/dates";
import type { OrderDetail } from "./types";

export function StatusHeader({ order }: { order: OrderDetail }) {
  const cfg = ORDER_STATUS[order.status] ?? ORDER_STATUS.PENDING;
  const isPickup = order.fulfillmentType === "PICKUP";
  return (
    <SectionCard>
      <View style={styles.statusRow}>
        <View style={styles.statusMain}>
          <Text style={styles.orderId} selectable>#{order.id.slice(0, 8)}</Text>
          <Text style={styles.placed}>Placed {timeAgo(order.createdAt)} · {formatDate(order.createdAt, true)}</Text>
        </View>
        <StatusPill label={cfg.label} color={cfg.color} bg={cfg.bg} dot />
      </View>
      <View style={styles.modeRow}>
        <Ionicons name={isPickup ? "bag-handle-outline" : "bicycle-outline"} size={16} color={colors.primary} />
        <Text style={styles.mode}>{isPickup ? "Store pickup" : "Home delivery"}</Text>
      </View>
    </SectionCard>
  );
}

export function CustomerCard({ order }: { order: OrderDetail }) {
  const { user } = order;
  const isPickup = order.fulfillmentType === "PICKUP";
  return (
    <SectionCard title="Customer">
      <Text style={styles.name}>{user.name || user.email}</Text>
      {user.phone ? (
        <TouchableOpacity style={styles.call} onPress={() => Linking.openURL(`tel:${user.phone}`)} accessibilityRole="button" accessibilityLabel={`Call ${user.phone}`}>
          <Ionicons name="call" size={16} color={colors.primary} />
          <Text style={styles.phone}>{user.phone}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.muted}>{user.email}</Text>
      )}
      <KeyValue label={isPickup ? "Pickup location" : "Delivery address"} value={order.deliveryAddress} />
      {order.deliveryNotes ? <KeyValue label="Notes" value={order.deliveryNotes} /> : null}
    </SectionCard>
  );
}

export function FulfilmentCard({ order }: { order: OrderDetail }) {
  const slot = order.scheduledDate && order.slotStartTime
    ? `${formatDate(order.scheduledDate)} · ${order.slotStartTime} – ${order.slotEndTime}`
    : null;
  const rider = order.deliveryTrip?.rider;
  if (!slot && !order.estimatedDeliveryAt && !order.deliveryTrip) return null;

  return (
    <SectionCard title="Delivery">
      {slot ? <KeyValue label="Scheduled slot" value={slot} /> : null}
      {!slot && order.estimatedDeliveryAt ? <KeyValue label="Express ETA" value={formatDate(order.estimatedDeliveryAt, true)} /> : null}
      {rider ? <KeyValue label="Rider" value={rider.name} /> : null}
      {rider?.phone ? (
        <TouchableOpacity style={styles.call} onPress={() => Linking.openURL(`tel:${rider.phone}`)} accessibilityRole="button">
          <Ionicons name="call" size={16} color={colors.primary} />
          <Text style={styles.phone}>{rider.phone}</Text>
        </TouchableOpacity>
      ) : null}
      {order.deliveryTrip ? <KeyValue label="Trip" value={`${order.deliveryTrip.status}${order.deliverySequence ? ` · stop ${order.deliverySequence}` : ""}`} /> : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  statusMain: { flex: 1 },
  orderId: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, letterSpacing: -0.4 },
  placed: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: manage.hairline },
  mode: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  call: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  phone: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  muted: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, marginVertical: 4 },
});
