import { memo, useEffect, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { etaLabel, friendlyTime, slotLabel } from "./format";
import { isHeadlineStatus, statusMeta } from "./status";
import type { OrderSummary } from "./types";

const IMAGE = 72;

interface Props {
  order: OrderSummary;
  active: boolean;
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

/** The line that says where the order stands: when it arrives while it's moving, else its status and when */
function useStatusLine(order: OrderSummary, active: boolean) {
  const t = useStrings("orders").card;
  const meta = statusMeta(order);
  if (active && isHeadlineStatus(order)) {
    return order.fulfillmentType === "PICKUP" ? t.readyAtCounter : etaLabel(order.estimatedDeliveryAt) ?? t.onTheWayToYou;
  }
  return `${meta.label} · ${(active && slotLabel(order)) || friendlyTime(order.createdAt)}`;
}

/** The first item's picture, with how many items the order holds when there's more than one */
function OrderPicture({ order, muted }: { order: OrderSummary; muted: boolean }) {
  const first = order.items[0];
  const uri = first ? first.variant.imageUrl ?? first.product.imageUrl : null;
  return (
    <View style={[styles.picture, muted && styles.muted]}>
      {uri ? <Image source={{ uri }} style={styles.image} /> : <Ionicons name="cube-outline" size={26} color="#94a3b8" />}
      {order.items.length > 1 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{order.items.length}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * One order as a list row: picture, where it stands, what it is. Open orders sit on a tint with a live status in
 * teal, and one out for delivery offers Track in place of the chevron; everything else lives on the order's page.
 */
export const OrderRow = memo(function OrderRow({ order, active, onOpen, onTrack }: Props) {
  const t = useStrings("orders").card;
  const { getLocalizedName } = useLanguage();
  const status = useStatusLine(order, active);
  const cancelled = order.status === "CANCELLED";
  const live = active && isHeadlineStatus(order);
  const trackable = order.status === "OUT_FOR_DELIVERY" && order.fulfillmentType === "DELIVERY";
  const first = order.items[0];

  return (
    <Pressable
      onPress={() => onOpen(order.id)}
      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <OrderPicture order={order} muted={cancelled} />
      <View style={styles.text}>
        <View style={styles.statusRow}>
          {live && <LiveDot />}
          <Text style={[styles.status, active && styles.statusActive, cancelled && styles.statusCancelled]} numberOfLines={1}>
            {status}
          </Text>
        </View>
        {first && <Text style={styles.name} numberOfLines={2}>{getLocalizedName(first.product)}</Text>}
      </View>
      {trackable ? (
        <Pressable onPress={() => onTrack(order.id)} style={styles.track} accessibilityRole="button" hitSlop={6}>
          <Ionicons name="navigate" size={14} color="#fff" />
          <Text style={styles.trackText}>{t.trackLive}</Text>
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff" },
  rowActive: { backgroundColor: "#f0fdfa" },
  pressed: { opacity: 0.85 },
  picture: { width: IMAGE, height: IMAGE, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  image: { width: IMAGE - 12, height: IMAGE - 12, resizeMode: "contain", mixBlendMode: "multiply" },
  muted: { opacity: 0.5 },
  badge: {
    position: "absolute", right: -6, bottom: -6, minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12,
    backgroundColor: colors.text, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  badgeText: { fontSize: 11, fontFamily: fonts.extrabold, color: "#fff" },
  text: { flex: 1, gap: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  status: { flexShrink: 1, fontSize: 15, fontFamily: fonts.extrabold, color: colors.text },
  statusActive: { color: colors.primary },
  statusCancelled: { color: "#dc2626" },
  name: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 19, color: colors.text },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  liveRing: { ...StyleSheet.absoluteFillObject, borderRadius: 4, backgroundColor: colors.primary },
  track: { flexDirection: "row", alignItems: "center", gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.primary },
  trackText: { fontSize: 13, fontFamily: fonts.bold, color: "#fff" },
});
