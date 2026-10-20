import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import type { ReturnRequestData } from "../../lib/types";
import { OrderItemRow } from "./OrderItemRow";
import { returnTags } from "./ReturnStateLine";
import { returnWindowLine } from "./order-status";
import type { OrderData } from "./types";

interface Actions {
  reordering: boolean;
  cancelling: boolean;
  rated: number | null;
  onReorder: () => void;
  onCancel: () => void;
  onRate: () => void;
}

interface PillProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** The one action to lead with, in amber like Amazon's "Buy it again" */
  highlight?: boolean;
  busy?: boolean;
}

function Pill({ icon, label, onPress, highlight, busy }: PillProps) {
  const color = highlight ? colors.accentText : colors.text;
  return (
    <TouchableOpacity style={[styles.pill, highlight && styles.pillHighlight]} onPress={onPress} disabled={busy} activeOpacity={0.7}>
      {busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={16} color={color} />}
      <Text style={[styles.pillText, highlight && styles.pillTextHighlight]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Cancel stays a full-width button while the store hasn't started on the order */
function CancelButton({ order, actions }: { order: OrderData; actions: Actions }) {
  const t = useStrings("orders").detail;
  if (order.status !== "PENDING" && order.status !== "CONFIRMED") return null;
  return (
    <TouchableOpacity style={styles.cancel} onPress={actions.onCancel} disabled={actions.cancelling} activeOpacity={0.7}>
      {actions.cancelling ? <ActivityIndicator color={colors.error} /> : <Text style={styles.cancelText}>{t.cancelOrder}</Text>}
    </TouchableOpacity>
  );
}

export function ItemsCard({ order, returnRequest, actions }: { order: OrderData; returnRequest: ReturnRequestData | null; actions: Actions }) {
  const router = useRouter();
  const t = useStrings("orders").detail;
  const r = useStrings("orders").reorder;
  const tags = returnTags(returnRequest);
  const window = returnRequest ? null : returnWindowLine(order);
  const delivered = order.status === "DELIVERED";
  const finished = delivered || order.status === "CANCELLED";
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t.itemsCount(order.items.reduce((n, i) => n + i.quantity, 0))}</Text>
      {window ? (
        <View style={styles.window}>
          <Ionicons name={window.open ? "return-down-back-outline" : "lock-closed-outline"} size={15} color={window.open ? colors.primary : colors.textSecondary} />
          <Text style={[styles.windowText, window.open && styles.windowOpen]}>{window.text}</Text>
        </View>
      ) : null}
      {order.items.map((item) => <OrderItemRow key={item.id} item={item} returnTag={tags.get(item.id)} />)}
      <View style={styles.actions}>
        <CancelButton order={order} actions={actions} />
        <View style={styles.pills}>
          {finished && <Pill icon="refresh" label={r.button} onPress={actions.onReorder} busy={actions.reordering} highlight />}
          {delivered && <Pill icon="create-outline" label={actions.rated ? t.ratedOrder(actions.rated) : t.writeReview} onPress={actions.onRate} />}
          {window?.open && <Pill icon="return-down-back-outline" label={t.returnItems} onPress={() => router.push({ pathname: "/return-request", params: { orderId: order.id } })} />}
          <Pill icon="headset-outline" label={t.getHelp} onPress={() => router.push({ pathname: "/support-chat", params: { orderId: order.id } })} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 16, paddingTop: 16 },
  title: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.text },
  window: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, marginBottom: 2 },
  windowText: { fontSize: 13.5, fontFamily: fonts.medium, color: colors.textSecondary },
  windowOpen: { color: colors.primary, fontFamily: fonts.semibold },
  actions: { paddingVertical: 14, gap: 10 },
  cancel: { alignItems: "center", justifyContent: "center", borderRadius: 24, minHeight: 48, borderWidth: 1.5, borderColor: "#fecaca" },
  cancelText: { fontSize: 15, fontFamily: fonts.bold, color: colors.error },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 22, paddingHorizontal: 14, minHeight: 44 },
  pillHighlight: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  pillTextHighlight: { fontFamily: fonts.bold, color: colors.accentText },
});
