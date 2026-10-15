import { StyleSheet } from "react-native";
import { Button } from "../ui/Button";
import { actionColor, actionLabel, canCancel, forwardStatus } from "./order-flow";
import type { OrderDetail } from "./types";

interface OrderActionBarProps {
  order: OrderDetail;
  running: boolean;
  onAdvance: (status: string) => void;
  onCancel: () => void;
}

export function OrderActionBar({ order, running, onAdvance, onCancel }: OrderActionBarProps) {
  const next = forwardStatus(order);
  return (
    <>
      {canCancel(order) && <Button label="Cancel" variant="danger" icon="close-circle-outline" onPress={onCancel} disabled={running} style={styles.cancel} />}
      {next && (
        <Button
          label={actionLabel(next, order.fulfillmentType)}
          onPress={() => onAdvance(next)}
          loading={running}
          style={{ ...styles.primary, backgroundColor: actionColor(next), borderColor: actionColor(next) }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  cancel: { flex: 1 },
  primary: { flex: 2 },
});
