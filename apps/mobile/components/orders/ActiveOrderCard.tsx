import { memo, useEffect, useRef } from "react";
import { Animated, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { useLanguage } from "../../lib/language-context";
import { etaLabel, friendlyTime, rupees, slotLabel } from "./format";
import { isHeadlineStatus, statusMeta } from "./status";
import type { OrderSummary } from "./types";
import { cardStyles } from "./card-styles";
import { ItemLines } from "./ItemLines";

interface Props {
  order: OrderSummary;
  onOpen: (id: string) => void;
  onTrack: (id: string) => void;
}

function LiveDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ring = { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] };
  return (
    <View style={styles.liveDot}>
      <Animated.View style={[styles.liveRing, ring]} />
    </View>
  );
}

/** The live order's delivery, grouped in one tinted panel inside the card: when it arrives and who is bringing it */
function DeliveryPanel({ order }: { order: OrderSummary }) {
  const t = useStrings("orders").card;
  const pickup = order.fulfillmentType === "PICKUP";
  const title = pickup ? t.readyAtCounter : etaLabel(order.estimatedDeliveryAt) ?? t.onTheWayToYou;
  const rider = order.status === "OUT_FOR_DELIVERY" ? order.deliveryTrip?.rider : null;
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <LiveDot />
        <Text style={styles.panelTitle}>{title}</Text>
        <View style={styles.panelIcon}>
          <Ionicons name={pickup ? "storefront" : "bicycle"} size={22} color="#fff" />
        </View>
      </View>
      {rider && <RiderRow rider={rider} />}
    </View>
  );
}

function PlainHead({ order }: { order: OrderSummary }) {
  const t = useStrings("orders").card;
  const { getLocalizedName } = useLanguage();
  const slot = slotLabel(order);
  const meta = statusMeta(order);
  return (
    <View style={styles.plainHead}>
      <View style={[styles.headIcon, slot ? styles.headIconSlot : null]}>
        <Ionicons name={slot ? "calendar" : "receipt"} size={20} color={slot ? "#b45309" : colors.primary} />
      </View>
      <View style={styles.headText}>
        <Text style={styles.headKey}>{slot ? t.scheduledDelivery : getLocalizedName(order.store)}</Text>
        <Text style={styles.headValue}>{slot ?? t.placedAt(friendlyTime(order.createdAt))}</Text>
      </View>
      <View style={[cardStyles.pill, { backgroundColor: meta.bg }]}>
        <Text style={[cardStyles.pillText, { color: meta.fg }]}>{meta.label}</Text>
      </View>
    </View>
  );
}

function RiderRow({ rider }: { rider: { name: string; phone: string | null } }) {
  const t = useStrings("orders").card;
  return (
    <View style={styles.rider}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{rider.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.headText}>
        <Text style={styles.riderName}>{rider.name}</Text>
        <Text style={styles.riderRole}>{t.deliveryPartner}</Text>
      </View>
      {rider.phone && (
        <TouchableOpacity style={styles.call} onPress={() => Linking.openURL(`tel:${rider.phone}`)} accessibilityLabel={t.callRider(rider.name)}>
          <Ionicons name="call" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export const ActiveOrderCard = memo(function ActiveOrderCard({ order, onOpen, onTrack }: Props) {
  const t = useStrings("orders").card;
  const headline = isHeadlineStatus(order);
  const trackable = order.status === "OUT_FOR_DELIVERY" && order.fulfillmentType === "DELIVERY";

  return (
    <TouchableOpacity activeOpacity={0.9} style={cardStyles.card} onPress={() => onOpen(order.id)}>
      <PlainHead order={order} />
      {headline && <DeliveryPanel order={order} />}
      <View style={styles.items}>
        <ItemLines order={order} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t.total}</Text>
          <Text style={styles.total}>{rupees(order.totalAmount)}</Text>
        </View>
      </View>
      {/* The card itself opens the order (cancel lives there); only live tracking earns a button here */}
      {trackable && (
        <TouchableOpacity style={styles.track} onPress={() => onTrack(order.id)}>
          <Ionicons name="navigate" size={16} color="#fff" />
          <Text style={styles.trackText}>{t.trackLive}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  // The delivery sits in its own tinted panel inside the order card, so it reads as this order's delivery
  panel: { marginHorizontal: 12, marginTop: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: "#f0fdfa" },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  panelTitle: { flex: 1, fontSize: 17, fontFamily: fonts.extrabold, color: colors.text },
  panelIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  liveRing: { ...StyleSheet.absoluteFillObject, borderRadius: 4, backgroundColor: colors.primary },
  plainHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  headIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  headIconSlot: { backgroundColor: "#fef3c7" },
  headText: { flex: 1 },
  headKey: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary },
  headValue: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text, marginTop: 1 },
  rider: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 12, marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: "#fff" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fde68a", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontFamily: fonts.extrabold, color: "#92400e" },
  riderName: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  riderRole: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },
  call: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  items: { paddingHorizontal: 16, paddingBottom: 14, marginTop: 14, gap: 10 },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },
  total: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.text },
  track: { height: 44, marginHorizontal: 16, marginBottom: 16, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primary },
  trackText: { fontSize: 14, fontFamily: fonts.bold, color: "#fff" },
});
