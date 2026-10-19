import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import type { OrderPickup } from "../orders/types";
import { orderRef } from "./format";

type PickupLine = OrderPickup["items"][number];

const STRIP_MAX = 4;

const imageOf = (line: PickupLine) =>
  line.orderItem.variant.imageUrl ?? line.orderItem.product.imageUrl ?? line.orderItem.product.images?.[0] ?? null;


function Thumb({ line, size }: { line: PickupLine; size: number }) {
  const uri = imageOf(line);
  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      {uri ? <Image source={{ uri }} style={styles.thumbImage} resizeMode="contain" /> : <Ionicons name="cube-outline" size={size / 2.5} color={manage.muted} />}
      {line.quantity > 1 && (
        <View style={styles.qtyBadge}>
          <Text style={styles.qtyBadgeText}>×{line.quantity}</Text>
        </View>
      )}
    </View>
  );
}

/** A row of product photos, so the rider can match what the customer hands over at a glance */
export function PickupThumbs({ lines, size = 44 }: { lines: PickupLine[]; size?: number }) {
  const extra = lines.length - STRIP_MAX;
  return (
    <View style={styles.strip}>
      {lines.slice(0, STRIP_MAX).map((line, i) => <Thumb key={i} line={line} size={size} />)}
      {extra > 0 && (
        <View style={[styles.thumb, styles.more, { width: size, height: size }]}>
          <Text style={styles.moreText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

/** In the stop sheet: every returned item with its photo, grouped by the order it came from */
export function PickupList({ pickups }: { pickups: OrderPickup[] }) {
  if (!pickups.length) return null;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="return-down-back-outline" size={18} color={manage.attentionText} />
        <Text style={styles.title}>Collect from the customer</Text>
      </View>
      {pickups.map((p) => (
        <View key={p.id} style={styles.group}>
          <Text style={styles.groupLabel}>Return on order {orderRef(p.orderId)} · {p.reason}</Text>
          {p.items.map((line, i) => (
            <View key={i} style={styles.line}>
              <Thumb line={{ ...line, quantity: 1 }} size={56} />
              <View style={styles.lineText}>
                <Text style={styles.lineName} numberOfLines={2}>{line.orderItem.product.name}</Text>
                <Text style={styles.lineVariant}>{line.orderItem.variant.name}</Text>
              </View>
              <Text style={styles.lineQty}>× {line.quantity}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: manage.attentionBg, borderLeftWidth: 4, borderLeftColor: colors.accent },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: manage.attentionText },
  strip: { flexDirection: "row", gap: 8 },
  thumb: { borderRadius: 8, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  thumbImage: { width: "88%", height: "88%" },
  qtyBadge: { position: "absolute", right: 0, bottom: 0, paddingHorizontal: 4, borderTopLeftRadius: 6, backgroundColor: manage.attentionText },
  qtyBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: "#fff" },
  more: { backgroundColor: "#fde68a" },
  moreText: { fontFamily: fonts.bold, fontSize: 14, color: manage.attentionText },
  group: { gap: 8 },
  groupLabel: { fontFamily: fonts.semibold, fontSize: 13, color: manage.attentionText },
  line: { flexDirection: "row", alignItems: "center", gap: 12 },
  lineText: { flex: 1 },
  lineName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  lineVariant: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  lineQty: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, minWidth: 36, textAlign: "right" },
});
