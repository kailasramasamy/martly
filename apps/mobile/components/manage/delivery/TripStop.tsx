import { useState } from "react";
import { View, Linking, StyleSheet } from "react-native";
import { handoverNote } from "@martly/shared/order-flow";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { ORDER_STATUS, formatINR } from "../ui/tokens";
import type { MenuOrder } from "./types";

interface TripStopProps {
  order: MenuOrder;
  /** Can mark this stop delivered: a dispatcher, or the rider on their own trip */
  canDeliver: boolean;
  /** Show rider aids: cash to collect and a Navigate button */
  forRider: boolean;
  onChanged: () => void;
  onMenu: () => void;
}

const isUnpaidCod = (o: MenuOrder) => o.paymentMethod === "COD" && o.paymentStatus !== "PAID";

/** One stop on a trip: who, where, how much; out-for-delivery stops can be marked delivered after a confirm */
export function TripStop({ order, canDeliver, forRider, onChanged, onMenu }: TripStopProps) {
  const { run, running } = useAction();
  const [confirming, setConfirming] = useState(false);
  const out = order.status === "OUT_FOR_DELIVERY";
  const cash = isUnpaidCod(order) ? `Collect ${formatINR(order.totalAmount)} cash` : null;

  const deliver = async () => {
    const res = await run(() => api.patch(`/api/v1/orders/${order.id}/status`, { status: "DELIVERED" }), "Order delivered");
    setConfirming(false);
    if (res !== undefined) onChanged();
  };
  const navigate = () => {
    if (order.deliveryAddress) Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.deliveryAddress)}`);
  };

  return (
    <>
      <ListRow
        title={`#${order.id.slice(0, 8)} · ${order.user.name}`}
        subtitle={order.deliveryAddress ?? undefined}
        caption={forRider && out ? cash ?? "Already paid" : undefined}
        value={formatINR(order.totalAmount)}
        railColor={ORDER_STATUS[order.status]?.color}
        onPress={onMenu}
        trailing={out && canDeliver
          ? <Button compact label="Mark delivered" icon="checkmark" loading={running} onPress={() => setConfirming(true)} />
          : <StatusPill {...ORDER_STATUS[order.status]} />}
      />
      {forRider && out && order.deliveryAddress ? (
        <View style={styles.navigate}>
          <Button compact variant="secondary" label="Navigate" icon="navigate-outline" onPress={navigate} />
        </View>
      ) : null}
      <ConfirmDialog
        visible={confirming}
        title={`Mark #${order.id.slice(0, 8)} delivered?`}
        message={handoverNote(order)}
        confirmLabel="Mark Delivered"
        cancelLabel="Not yet"
        confirmVariant="primary"
        running={running}
        onConfirm={deliver}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  navigate: { paddingHorizontal: 16, paddingBottom: 10, alignItems: "flex-start" },
});
