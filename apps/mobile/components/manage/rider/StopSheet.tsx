import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../search/BottomSheet";
import { OrderItemRow } from "../orders/OrderItemRow";
import { colors, fonts } from "../../../constants/theme";
import { formatINR, manage, tabular } from "../ui/tokens";
import { PickupList } from "./PickupItems";
import { orderRef, stopWindow } from "./format";
import type { RiderStop } from "./types";

function Line({ icon, children, onPress }: { icon: keyof typeof Ionicons.glyphMap; children: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.line} disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? "button" : undefined}>
      <Ionicons name={icon} size={18} color={onPress ? colors.primary : manage.muted} />
      <Text style={[styles.lineText, onPress && styles.link, tabular]}>{children}</Text>
    </TouchableOpacity>
  );
}

function Money({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.money}>
      <Text style={[styles.moneyLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.moneyValue, strong && styles.strong, tabular]}>{value}</Text>
    </View>
  );
}

function Payment({ stop }: { stop: RiderStop }) {
  const wallet = Number(stop.walletAmountUsed ?? 0);
  const loyalty = Number(stop.loyaltyPointsUsed ?? 0);
  return (
    <View style={styles.payment}>
      <Money label={`Order total · ${stop.paymentMethod === "COD" ? "cash on delivery" : "paid online"}`} value={formatINR(Number(stop.totalAmount))} />
      {wallet > 0 && <Money label="Paid from wallet" value={`−${formatINR(wallet)}`} />}
      {loyalty > 0 && <Money label="Loyalty points" value={`−${formatINR(loyalty)}`} />}
      {Number(stop.refusedAmount ?? 0) > 0 && <Money label="Handed back at door" value={`−${formatINR(Number(stop.refusedAmount))}`} />}
      <Money label={stop.amountDue > 0 ? "Collect in cash" : "Nothing to collect"} value={formatINR(stop.amountDue)} strong />
    </View>
  );
}

function Details({ stop }: { stop: RiderStop }) {
  const window = stopWindow(stop);
  return (
    <View style={styles.details}>
      <Line icon="receipt-outline">{`Order ${orderRef(stop.id)}`}</Line>
      <Line icon="location-outline">{stop.deliveryAddress ?? "No address"}</Line>
      {stop.user.phone ? <Line icon="call-outline" onPress={() => Linking.openURL(`tel:${stop.user.phone}`)}>{stop.user.phone}</Line> : null}
      {window ? <Line icon="time-outline">{`Window ${window}`}</Line> : null}
      {stop.deliveryNotes ? <Line icon="chatbubble-ellipses-outline">{stop.deliveryNotes}</Line> : null}
    </View>
  );
}

/** Everything about one stop: where, who, instructions, the items to hand over and the payment maths */
export function StopSheet({ stop, onClose }: { stop: RiderStop | null; onClose: () => void }) {
  return (
    <BottomSheet visible={!!stop} title={stop?.user.name ?? ""} onClose={onClose} flush>
      {stop && (
        <ScrollView keyboardDismissMode="on-drag">
          <Details stop={stop} />
          {stop.pickups.length > 0 && <View style={styles.pickup}><PickupList pickups={stop.pickups} /></View>}
          <Payment stop={stop} />
          <Text style={styles.heading}>{stop.items.length} item{stop.items.length === 1 ? "" : "s"}</Text>
          {stop.items.map((item) => <OrderItemRow key={item.id} item={item} />)}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  details: { marginHorizontal: 16, paddingHorizontal: 12, borderRadius: 12, backgroundColor: manage.canvas },
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingVertical: 8 },
  lineText: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.text },
  link: { fontFamily: fonts.bold, color: colors.primary },
  pickup: { marginHorizontal: 16, marginTop: 12 },
  payment: { margin: 16, padding: 12, gap: 6, borderRadius: 12, borderWidth: 1, borderColor: manage.line },
  money: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  moneyLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  moneyValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  strong: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  heading: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", color: colors.textSecondary, paddingHorizontal: 16, paddingBottom: 4 },
});
