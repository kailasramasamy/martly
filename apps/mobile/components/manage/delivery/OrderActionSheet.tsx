import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { NEXT_ACTION_LABELS, nextStatuses } from "@martly/shared/order-flow";
import { BottomSheet } from "../../search/BottomSheet";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { Button } from "../ui/Button";
import { formatINR } from "../ui/tokens";
import type { BoardOrder } from "./types";

interface OrderActionSheetProps {
  order: BoardOrder | null;
  onClose: () => void;
  onChanged: () => void;
}

export function OrderActionSheet({ order, onClose, onChanged }: OrderActionSheetProps) {
  const router = useRouter();
  const { run, running } = useAction();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const allowed = order ? nextStatuses(order.status, order.fulfillmentType) : [];
  const next = allowed.find((s) => s !== "CANCELLED");
  const canCancel = allowed.includes("CANCELLED");
  const meta = next ? NEXT_ACTION_LABELS[next] : null;
  const nextLabel = meta ? (order?.fulfillmentType === "PICKUP" && meta.pickupLabel) || meta.label : "";

  const setStatus = async (status: string, message: string) => {
    if (!order) return;
    const res = await run(() => api.patch(`/api/v1/orders/${order.id}/status`, { status }), message);
    setConfirmCancel(false);
    if (res) {
      onClose();
      onChanged();
    }
  };

  const openOrder = () => {
    const id = order?.id;
    onClose();
    if (id) router.push(`/manage/orders/${id}`);
  };

  return (
    <>
    <BottomSheet visible={!!order} title={order ? `#${order.id.slice(0, 8)} · ${order.user.name}` : ""} onClose={onClose}>
      {order && (
        <View style={styles.body}>
          <Text style={styles.meta}>{formatINR(order.totalAmount)} · {order.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ")}</Text>
          {next && <Button label={nextLabel} onPress={() => setStatus(next, "Order updated")} loading={running && !confirmCancel} />}
          {canCancel && <Button label="Cancel order" variant="danger" onPress={() => setConfirmCancel(true)} />}
          <Button label="Open order" variant="secondary" icon="open-outline" onPress={openOrder} />
        </View>
      )}
    </BottomSheet>
      <ConfirmDialog
        visible={confirmCancel}
        title="Cancel this order?"
        message="The customer is notified and reserved stock is released."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        running={running}
        onConfirm={() => setStatus("CANCELLED", "Order cancelled")}
        onClose={() => setConfirmCancel(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 10 },
  meta: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, marginBottom: 4 },
});
