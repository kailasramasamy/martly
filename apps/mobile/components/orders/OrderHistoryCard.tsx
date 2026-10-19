import { memo } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { ReturnStateLine } from "../order/ReturnStateLine";
import { friendlyTime, itemCount, itemPreview, rupees } from "./format";
import { statusMeta } from "./status";
import type { OrderSummary } from "./types";
import { cardStyles } from "./card-styles";

const THUMBS = 4;
const THUMB_TINTS = ["#eff6ff", "#fef3c7", "#fce7f3", "#dcfce7"];

interface Props {
  order: OrderSummary;
  reordering: boolean;
  onOpen: (id: string) => void;
  onReorder: (order: OrderSummary) => void;
}

function Thumbs({ order }: { order: OrderSummary }) {
  const rest = order.items.length - THUMBS;
  return (
    <View style={styles.thumbs}>
      {order.items.slice(0, THUMBS).map((item, i) => {
        const uri = item.variant.imageUrl ?? item.product.imageUrl;
        return (
          <View key={item.id} style={[styles.thumb, { backgroundColor: THUMB_TINTS[i % THUMB_TINTS.length] }]}>
            {uri ? <Image source={{ uri }} style={styles.thumbImg} /> : <Ionicons name="cube-outline" size={22} color="#94a3b8" />}
          </View>
        );
      })}
      {rest > 0 && (
        <View style={[styles.thumb, styles.thumbMore]}>
          <Text style={styles.thumbMoreText}>+{rest}</Text>
        </View>
      )}
    </View>
  );
}

export const OrderHistoryCard = memo(function OrderHistoryCard({ order, reordering, onOpen, onReorder }: Props) {
  const meta = statusMeta(order);
  const cancelled = order.status === "CANCELLED";
  const canRate = order.status === "DELIVERED" && order.storeRatings.length === 0;
  const { names, more } = itemPreview(order, 3);
  const count = itemCount(order);

  return (
    <TouchableOpacity activeOpacity={0.9} style={cardStyles.card} onPress={() => onOpen(order.id)}>
      <View style={styles.body}>
        <View style={styles.headRow}>
          <View style={styles.store}>
            <View style={styles.storeMark}>
              <Text style={styles.storeMarkText}>{order.store.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.storeName} numberOfLines={1}>{order.store.name}</Text>
          </View>
          <View style={[cardStyles.pill, { backgroundColor: meta.bg }]}>
            {order.status === "DELIVERED" && <Ionicons name="checkmark" size={12} color={meta.fg} />}
            <Text style={[cardStyles.pillText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.when}>
          {friendlyTime(order.createdAt)}{order.fulfillmentType === "PICKUP" ? " · Store pickup" : ""}
        </Text>

        <View style={cancelled && styles.muted}>
          <Thumbs order={order} />
        </View>
        <Text style={styles.names} numberOfLines={2}>
          <Text style={styles.namesLead}>{names[0]}</Text>
          {names.slice(1).map((n) => `, ${n}`).join("")}{more ? ` ${more}` : ""}
        </Text>

        {order.returnRequest && (
          <View style={styles.returnLine}>
            <ReturnStateLine request={order.returnRequest} />
          </View>
        )}

        <View style={styles.foot}>
          <Text style={[styles.amount, cancelled && styles.amountMuted]}>
            {rupees(order.totalAmount)}
            <Text style={styles.count}>  {count} item{count !== 1 ? "s" : ""}</Text>
          </Text>
          <View style={styles.footActions}>
            {canRate && (
              <TouchableOpacity style={[styles.sbtn, styles.sbtnGhost]} onPress={() => onOpen(order.id)} accessibilityLabel="Rate this order">
                <Ionicons name="star-outline" size={14} color={colors.text} />
                <Text style={styles.sbtnGhostText}>Rate</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.sbtn, styles.sbtnPrimary]} onPress={() => onReorder(order)} disabled={reordering}>
              {reordering ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="refresh" size={14} color="#fff" />}
              <Text style={styles.sbtnPrimaryText}>Reorder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 14 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  store: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  storeMark: { width: 22, height: 22, borderRadius: 6, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  storeMarkText: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.primary },
  storeName: { fontSize: 14, fontFamily: fonts.bold, color: colors.text, flexShrink: 1 },
  when: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 4 },
  thumbs: { flexDirection: "row", gap: 8, marginTop: 12 },
  thumb: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: "#f1f5f9", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: 44, height: 44, resizeMode: "contain" },
  thumbMore: { backgroundColor: colors.surface },
  thumbMoreText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  muted: { opacity: 0.5 },
  names: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 18, marginTop: 10 },
  namesLead: { fontFamily: fonts.semibold, color: colors.text },
  returnLine: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.surface },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingVertical: 12, borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.border },
  amount: { fontSize: 17, fontFamily: fonts.extrabold, color: colors.text },
  amountMuted: { color: colors.textSecondary },
  count: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  footActions: { flexDirection: "row", gap: 8 },
  sbtn: { height: 44, paddingHorizontal: 14, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 5 },
  sbtnPrimary: { backgroundColor: colors.primary },
  sbtnPrimaryText: { fontSize: 13, fontFamily: fonts.bold, color: "#fff" },
  sbtnGhost: { borderWidth: 1, borderColor: colors.border },
  sbtnGhostText: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
});
