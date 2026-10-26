import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Loader } from "../Loader";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { ReturnStateLine } from "../order/ReturnStateLine";
import { friendlyTime, itemCount, itemPreview, rupees } from "./format";
import { statusMeta } from "./status";
import type { OrderSummary } from "./types";
import { cardStyles } from "./card-styles";
import { ItemThumbs } from "./ItemThumbs";
import { StoreMark } from "../StoreMark";

interface Props {
  order: OrderSummary;
  reordering: boolean;
  onOpen: (id: string) => void;
  onReorder: (order: OrderSummary) => void;
}

export const OrderHistoryCard = memo(function OrderHistoryCard({ order, reordering, onOpen, onReorder }: Props) {
  const t = useStrings("orders").card;
  const common = useStrings("common");
  const { getLocalizedName } = useLanguage();
  const meta = statusMeta(order);
  const cancelled = order.status === "CANCELLED";
  const canRate = order.status === "DELIVERED" && order.storeRatings.length === 0;
  const { names, more } = itemPreview(order, getLocalizedName, 3);
  const count = itemCount(order);

  return (
    <TouchableOpacity activeOpacity={0.9} style={cardStyles.card} onPress={() => onOpen(order.id)}>
      <View style={styles.body}>
        <View style={styles.headRow}>
          <View style={styles.store}>
            <StoreMark storeId={order.store.id} logoUrl={order.store.logoUrl} size={24} fallback={(
              <View style={styles.storeMark}>
                <Text style={styles.storeMarkText}>{order.store.name.charAt(0).toUpperCase()}</Text>
              </View>
            )} />
            <Text style={styles.storeName} numberOfLines={1}>{getLocalizedName(order.store)}</Text>
          </View>
          <View style={[cardStyles.pill, { backgroundColor: meta.bg }]}>
            {order.status === "DELIVERED" && <Ionicons name="checkmark" size={12} color={meta.fg} />}
            <Text style={[cardStyles.pillText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.when}>
          {friendlyTime(order.createdAt)}{order.fulfillmentType === "PICKUP" ? ` · ${t.storePickup}` : ""}
        </Text>

        <View style={cancelled && styles.muted}>
          <ItemThumbs order={order} />
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
            <Text style={styles.count}>  {common.items(count)}</Text>
          </Text>
          <View style={styles.footActions}>
            {canRate && (
              <TouchableOpacity style={[styles.sbtn, styles.sbtnGhost]} onPress={() => onOpen(order.id)} accessibilityLabel={t.rateThisOrder}>
                <Ionicons name="star-outline" size={14} color={colors.text} />
                <Text style={styles.sbtnGhostText}>{t.rate}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.sbtn, styles.sbtnPrimary]} onPress={() => onReorder(order)} disabled={reordering}>
              {reordering ? <Loader size="small" color="#fff" /> : <Ionicons name="refresh" size={14} color="#fff" />}
              <Text style={styles.sbtnPrimaryText}>{t.reorder}</Text>
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
