import { memo, useEffect, useRef } from "react";
import { Animated, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { StatusStepper } from "./StatusStepper";
import { etaLabel, friendlyTime, itemCount, itemPreview, rupees, slotLabel } from "./format";
import { isHeadlineStatus, orderSteps, statusMeta } from "./status";
import { CANCELLABLE_STATUSES, type OrderSummary } from "./types";
import { cardStyles } from "./card-styles";

interface Props {
  order: OrderSummary;
  onOpen: (id: string) => void;
  onTrack: (id: string) => void;
  onCancel: (id: string) => void;
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

function Headline({ order }: { order: OrderSummary }) {
  const pickup = order.fulfillmentType === "PICKUP";
  const title = pickup ? "Ready at the counter" : etaLabel(order.estimatedDeliveryAt) ?? "On the way to you";
  const count = itemCount(order);
  return (
    <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroText}>
        <View style={styles.eyebrow}>
          <LiveDot />
          <Text style={styles.eyebrowText}>{statusMeta(order).label}</Text>
        </View>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroMeta} numberOfLines={1}>
          {order.store.name} · {count} item{count !== 1 ? "s" : ""} · {rupees(order.totalAmount)}
        </Text>
      </View>
      <View style={styles.heroIcon}>
        <Ionicons name={pickup ? "storefront" : "bicycle"} size={28} color="#fff" />
      </View>
    </LinearGradient>
  );
}

function PlainHead({ order }: { order: OrderSummary }) {
  const slot = slotLabel(order);
  const meta = statusMeta(order);
  return (
    <View style={styles.plainHead}>
      <View style={[styles.headIcon, slot ? styles.headIconSlot : null]}>
        <Ionicons name={slot ? "calendar" : "receipt"} size={20} color={slot ? "#b45309" : colors.primary} />
      </View>
      <View style={styles.headText}>
        <Text style={styles.headKey}>{slot ? "Scheduled delivery" : order.store.name}</Text>
        <Text style={styles.headValue}>{slot ?? `Placed ${friendlyTime(order.createdAt)}`}</Text>
      </View>
      <View style={[cardStyles.pill, { backgroundColor: meta.bg }]}>
        <Text style={[cardStyles.pillText, { color: meta.fg }]}>{meta.label}</Text>
      </View>
    </View>
  );
}

function RiderRow({ rider }: { rider: { name: string; phone: string | null } }) {
  return (
    <View style={styles.rider}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{rider.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.headText}>
        <Text style={styles.riderName}>{rider.name}</Text>
        <Text style={styles.riderRole}>Your delivery partner</Text>
      </View>
      {rider.phone && (
        <TouchableOpacity style={styles.call} onPress={() => Linking.openURL(`tel:${rider.phone}`)} accessibilityLabel={`Call ${rider.name}`}>
          <Ionicons name="call" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export const ActiveOrderCard = memo(function ActiveOrderCard({ order, onOpen, onTrack, onCancel }: Props) {
  const headline = isHeadlineStatus(order);
  const { steps, current } = orderSteps(order);
  const { names, more } = itemPreview(order);
  const rider = order.status === "OUT_FOR_DELIVERY" ? order.deliveryTrip?.rider : null;
  const trackable = order.status === "OUT_FOR_DELIVERY" && order.fulfillmentType === "DELIVERY";

  return (
    <TouchableOpacity activeOpacity={0.9} style={cardStyles.card} onPress={() => onOpen(order.id)}>
      {headline ? <Headline order={order} /> : <PlainHead order={order} />}
      <StatusStepper steps={steps} current={current} />
      {rider && <RiderRow rider={rider} />}
      {!headline && (
        <Text style={styles.preview} numberOfLines={2}>
          <Text style={styles.previewLead}>{names[0]}</Text>
          {names[1] ? `, ${names[1]}` : ""}{more ? ` ${more}` : ""} · {rupees(order.totalAmount)}
        </Text>
      )}
      <View style={styles.actions}>
        {trackable && (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => onTrack(order.id)}>
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={styles.btnPrimaryText}>Track live</Text>
          </TouchableOpacity>
        )}
        {CANCELLABLE_STATUSES.includes(order.status) && (
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => onCancel(order.id)}>
            <Text style={styles.btnDangerText}>Cancel order</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => onOpen(order.id)}>
          <Text style={styles.btnGhostText}>Details</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  heroText: { flex: 1 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrowText: { fontSize: 12, fontFamily: fonts.semibold, color: "rgba(255,255,255,0.85)" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#5eead4" },
  liveRing: { ...StyleSheet.absoluteFillObject, borderRadius: 4, backgroundColor: "#5eead4" },
  heroTitle: { fontSize: 22, fontFamily: fonts.extrabold, color: "#fff", marginTop: 4, letterSpacing: -0.3 },
  heroMeta: { fontSize: 13, fontFamily: fonts.medium, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  heroIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", marginLeft: 12 },
  plainHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  headIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  headIconSlot: { backgroundColor: "#fef3c7" },
  headText: { flex: 1 },
  headKey: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary },
  headValue: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text, marginTop: 1 },
  rider: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 14, padding: 10, borderRadius: 12, backgroundColor: colors.surface },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fde68a", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontFamily: fonts.extrabold, color: "#92400e" },
  riderName: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  riderRole: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },
  call: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  preview: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 18, paddingHorizontal: 16, marginTop: 14 },
  previewLead: { fontFamily: fonts.semibold, color: colors.text },
  actions: { flexDirection: "row", gap: 10, padding: 16, paddingTop: 14 },
  btn: { flex: 1, height: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: 14, fontFamily: fonts.bold, color: "#fff" },
  btnGhost: { borderWidth: 1, borderColor: colors.border },
  btnGhostText: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  btnDanger: { borderWidth: 1, borderColor: "#fecaca" },
  btnDangerText: { fontSize: 14, fontFamily: fonts.bold, color: "#dc2626" },
});
