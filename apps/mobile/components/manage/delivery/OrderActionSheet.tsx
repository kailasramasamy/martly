import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { handoverNote } from "@martly/shared/order-flow";
import { BottomSheet } from "../../search/BottomSheet";
import { CANCEL_ORDER, ReasonSheet } from "../orders/ReasonSheet";
import { colors, fonts } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { OrderItemRow } from "../orders/OrderItemRow";
import { formatINR, manage, tabular } from "../ui/tokens";
import { RiderList } from "./RiderList";
import { useOrderMenu } from "./use-order-menu";
import type { MenuOrder } from "./types";

interface OrderActionSheetProps {
  order: MenuOrder | null;
  onClose: () => void;
  onChanged: () => void;
  onManageRiders: () => void;
}

function Customer({ order }: { order: MenuOrder }) {
  const phone = order.user.phone;
  return (
    <View style={styles.customer}>
      <View style={styles.line}>
        <Ionicons name="location-outline" size={18} color={manage.muted} />
        <Text style={styles.lineText}>{order.fulfillmentType === "PICKUP" ? "Pickup at store" : order.deliveryAddress ?? "No address"}</Text>
      </View>
      <TouchableOpacity style={styles.line} disabled={!phone} onPress={() => Linking.openURL(`tel:${phone}`)} accessibilityRole="button" accessibilityLabel={phone ? `Call ${order.user.name}` : "No phone"}>
        <Ionicons name="call-outline" size={18} color={phone ? colors.primary : manage.muted} />
        <Text style={[styles.lineText, phone && styles.phone, tabular]}>{phone ?? "No phone"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function OrderItems({ order }: { order: MenuOrder }) {
  const count = order.items.length;
  return (
    <>
      <Customer order={order} />
      <Text style={styles.meta}>{formatINR(order.totalAmount)} · {count} item{count === 1 ? "" : "s"}</Text>
      <ScrollView keyboardDismissMode="on-drag" style={styles.items}>
        {order.items.map((item) => <OrderItemRow key={item.id} item={item} />)}
      </ScrollView>
    </>
  );
}

/** Order menu on the delivery board: items, the next step, cancel and open. Sending out picks a rider inside this sheet (a second sheet can't stack on iOS). */
export function OrderActionSheet({ order, onClose, onChanged, onManageRiders }: OrderActionSheetProps) {
  const m = useOrderMenu(order, onClose, onChanged);
  const actions = order && (m.picking ? (
    <View style={styles.actions}>
      <Button label="Send out" icon="bicycle-outline" onPress={m.sendOut} loading={m.running} disabled={!m.riderId} />
      <Button label="Back" variant="secondary" onPress={() => m.setPicking(false)} />
    </View>
  ) : (
    <View style={styles.actions}>
      {m.confirmFinal && <Text style={styles.confirm}>{handoverNote(order)}</Text>}
      {m.next && <Button label={m.confirmFinal ? `Confirm: ${m.nextLabel}` : m.nextLabel} onPress={m.advance} loading={m.running && !m.confirmCancel} />}
      {m.riderless && <Button label="Assign rider" variant="secondary" icon="bicycle-outline" onPress={() => m.setPicking(true)} />}
      {m.canCancel && <Button label="Cancel order" variant="danger" onPress={() => m.setConfirmCancel(true)} />}
      <Button label="Open order" variant="secondary" icon="open-outline" onPress={m.openOrder} />
    </View>
  ));

  return (
    <>
      <BottomSheet
        visible={!!order}
        title={order ? (m.picking ? "Send out with rider" : `#${order.id.slice(0, 8)} · ${order.user.name}`) : ""}
        onClose={onClose}
        flush
        footer={actions}
      >
        {order && (m.picking
          ? <RiderList storeId={order.storeId} value={m.riderId} onChange={m.setRiderId} onManageRiders={() => { onClose(); onManageRiders(); }} />
          : <OrderItems order={order} />)}
      </BottomSheet>
      <ReasonSheet
        preset={CANCEL_ORDER}
        visible={m.confirmCancel}
        running={m.running}
        onConfirm={(reason) => m.setStatus("CANCELLED", "Order cancelled", reason)}
        onClose={() => m.setConfirmCancel(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actions: { paddingHorizontal: 16, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: manage.hairline },
  items: { flexGrow: 0 },
  customer: { marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: manage.canvas },
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingVertical: 8 },
  lineText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  phone: { fontFamily: fonts.semibold, color: colors.primary },
  confirm: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, backgroundColor: "#fef3c7", padding: 12, borderRadius: 10 },
  meta: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, paddingHorizontal: 16, paddingBottom: 6 },
});
