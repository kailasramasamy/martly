import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MonthlyListQuote } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { formatDate } from "../../lib/i18n/format";
import { clock } from "../checkout/SlotGrid";
import { BottomSheet } from "../search/BottomSheet";
import { Loader } from "../Loader";
import type { QuickOrder } from "./use-quick-order";

type Ready = Extract<MonthlyListQuote, { ready: true }>;
const rupees = (n: number) => n.toLocaleString("en-IN");

function useWhen() {
  const t = useStrings("monthlyList");
  const common = useStrings("common");
  return (delivery: Ready["delivery"]) => {
    if (delivery.kind === "EXPRESS") return t.express(delivery.etaMinutes);
    const today = new Date().toLocaleDateString("en-CA");
    const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA");
    const day = delivery.date === today ? common.today : delivery.date === tomorrow ? common.tomorrow : formatDate(`${delivery.date}T00:00:00`, { weekday: "short", day: "numeric", month: "short" });
    return t.slot(day, clock(delivery.startTime), clock(delivery.endTime));
  };
}

function Row({ icon, label, value, onChange }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onChange: () => void }) {
  const t = useStrings("monthlyList");
  return (
    <TouchableOpacity style={styles.row} onPress={onChange} accessibilityRole="button" accessibilityHint={t.change}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={16} color={colors.primary} /></View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
      </View>
      <Text style={styles.change}>{t.change}</Text>
    </TouchableOpacity>
  );
}

function Quote({ quote, placing, onPlace, onCheckout }: { quote: Ready; placing: boolean; onPlace: () => void; onCheckout: () => void }) {
  const t = useStrings("monthlyList");
  const when = useWhen();
  const count = quote.lines.length;
  return (
    <View style={styles.gap}>
      <View style={styles.rows}>
        <Row icon="location-outline" label={t.deliverTo} value={`${quote.address.label} · ${quote.address.address}`} onChange={onCheckout} />
        <Row icon="time-outline" label={t.when} value={when(quote.delivery)} onChange={onCheckout} />
        <Row icon="cash-outline" label={t.payWith} value={t.payOnDelivery} onChange={onCheckout} />
      </View>
      <View style={styles.bill}>
        <View style={styles.billRow}><Text style={styles.billLabel}>{t.items(count)}</Text><Text style={styles.billValue}>{`₹${rupees(quote.itemsTotal)}`}</Text></View>
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>{t.delivery}</Text>
          <Text style={quote.deliveryFee === 0 ? styles.free : styles.billValue}>{quote.deliveryFee === 0 ? t.free : `₹${rupees(quote.deliveryFee)}`}</Text>
        </View>
        <View style={[styles.billRow, styles.payRow]}><Text style={styles.pay}>{t.toPay}</Text><Text style={styles.pay}>{`₹${rupees(quote.toPay)}`}</Text></View>
      </View>
      <TouchableOpacity style={styles.primary} onPress={onPlace} disabled={placing} activeOpacity={0.85} accessibilityRole="button">
        {placing ? <Loader size="small" color="#ffffff" /> : <Text style={styles.primaryText}>{t.place(rupees(quote.toPay))}</Text>}
      </TouchableOpacity>
      <Text style={styles.note}>{t.oneTapNote}</Text>
      <TouchableOpacity style={styles.link} onPress={onCheckout} accessibilityRole="button"><Text style={styles.linkText}>{t.payOnline}</Text></TouchableOpacity>
    </View>
  );
}

function Placed({ month, next, onWalk, onView }: { month: string; next: string; onWalk: () => void; onView: () => void }) {
  const t = useStrings("monthlyList");
  return (
    <View style={styles.placed}>
      <View style={styles.tick}><Ionicons name="checkmark" size={32} color="#ffffff" /></View>
      <Text style={styles.placedTitle}>{t.placed(month)}</Text>
      <Text style={styles.note}>{t.placedBody(next)}</Text>
      <TouchableOpacity style={styles.primary} onPress={onView} accessibilityRole="button"><Text style={styles.primaryText}>{t.viewOrder}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={onWalk} accessibilityRole="button"><Text style={styles.secondaryText}>{t.anythingElse}</Text></TouchableOpacity>
    </View>
  );
}

function Blocked({ message, onCheckout }: { message: string; onCheckout: () => void }) {
  const t = useStrings("monthlyList");
  return (
    <View style={styles.gap}>
      <Text style={styles.blocked}>{message}</Text>
      <TouchableOpacity style={styles.primary} onPress={onCheckout} accessibilityRole="button"><Text style={styles.primaryText}>{t.openCheckout}</Text></TouchableOpacity>
    </View>
  );
}

interface Props {
  visible: boolean;
  /** "November", and the day next month's list is ready */
  month: string;
  next: string;
  state: QuickOrder;
  onPlace: () => void;
  onCheckout: () => void;
  onWalk: () => void;
  onView: (orderId: string) => void;
  onEdit: () => void;
  onClose: () => void;
}

/** One-tap order of this month's list, paid on delivery; anything else (another address, time or paying online) goes to checkout */
export function OrderSheet({ visible, month, next, state, onPlace, onCheckout, onWalk, onView, onEdit, onClose }: Props) {
  const t = useStrings("monthlyList");
  const placed = state.phase === "placed";
  return (
    <BottomSheet visible={visible} title={placed ? "" : t.listFor(month)} onClose={onClose} scrollable>
      {!placed && <TouchableOpacity style={styles.edit} onPress={onEdit} accessibilityRole="button"><Text style={styles.linkText}>{t.editList}</Text></TouchableOpacity>}
      {state.phase === "quoting" && <Loader />}
      {state.phase === "failed" && <Blocked message={state.message ?? t.orderFailed} onCheckout={onCheckout} />}
      {state.phase === "quoted" && !state.quote.ready && <Blocked message={t.blocked[state.quote.reason]} onCheckout={onCheckout} />}
      {state.phase === "quoted" && state.quote.ready && <Quote quote={state.quote} placing={false} onPlace={onPlace} onCheckout={onCheckout} />}
      {state.phase === "placing" && <Quote quote={state.quote} placing onPlace={onPlace} onCheckout={onCheckout} />}
      {state.phase === "placed" && <Placed month={month} next={next} onWalk={onWalk} onView={() => onView(state.orderId)} />}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 14 },
  edit: { alignSelf: "flex-end", marginTop: -6, marginBottom: 8, minHeight: 32, justifyContent: "center" },
  rows: { borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary },
  rowValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  change: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.primary },
  bill: { gap: 6 },
  billRow: { flexDirection: "row", justifyContent: "space-between" },
  billLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  billValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  free: { fontFamily: fonts.extrabold, fontSize: 13, color: "#15803d" },
  payRow: { paddingTop: 6, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  pay: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  primary: { height: 54, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  primaryText: { fontFamily: fonts.extrabold, fontSize: 16, color: "#ffffff" },
  secondary: { minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, alignSelf: "stretch" },
  secondaryText: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.primary },
  note: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, textAlign: "center" },
  link: { alignSelf: "center", minHeight: 44, justifyContent: "center" },
  linkText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.primary },
  blocked: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: "#78350f", backgroundColor: "#fef3c7", borderRadius: 10, padding: 12 },
  placed: { alignItems: "center", gap: 10, paddingVertical: 12 },
  tick: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  placedTitle: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, textAlign: "center" },
});
