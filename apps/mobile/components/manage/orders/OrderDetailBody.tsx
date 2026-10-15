import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SectionCard } from "../ui/SectionCard";
import { Button } from "../ui/Button";
import { StatusPill } from "../ui/StatusPill";
import { ListRow } from "../ui/ListRow";
import { formatINR } from "../ui/tokens";
import { CustomerCard, FulfilmentCard, StatusHeader } from "./OrderSummaryCards";
import { ItemsCard, PaymentBreakdown, TimelineCard } from "./OrderItemsCards";
import { RETURN_STATUS } from "./return-status";
import type { OrderDetail } from "./types";

interface OrderDetailBodyProps {
  order: OrderDetail;
  canEdit: boolean;
  running: boolean;
  onMarkPaid: () => void;
  onChangePayment: () => void;
}

export function OrderDetailBody({ order, canEdit, running, onMarkPaid, onChangePayment }: OrderDetailBodyProps) {
  const router = useRouter();
  const request = order.returnRequest;

  return (
    <>
      <StatusHeader order={order} />
      <CustomerCard order={order} />
      <ItemsCard order={order} />
      <PaymentBreakdown order={order} />
      {canEdit && order.paymentStatus !== "REFUNDED" && (
        <View style={styles.payActions}>
          {order.paymentStatus === "PENDING" && (
            <Button
              label={order.paymentMethod === "COD" ? "Mark cash collected" : "Mark paid"}
              icon="cash-outline"
              loading={running}
              onPress={onMarkPaid}
            />
          )}
          <Button label="Change payment status" variant="secondary" onPress={onChangePayment} />
        </View>
      )}
      <FulfilmentCard order={order} />
      {request && (
        <SectionCard title="Return request" flush>
          <ListRow
            title={`Return ${formatINR(Number(request.requestedAmount ?? 0))}`}
            trailing={<StatusPill {...(RETURN_STATUS[request.status] ?? RETURN_STATUS.PENDING)} />}
            icon="return-down-back-outline"
            onPress={() => router.push(`/manage/return-requests/${request.id}`)}
            chevron
          />
        </SectionCard>
      )}
      <TimelineCard order={order} />
    </>
  );
}

const styles = StyleSheet.create({
  payActions: { gap: 10 },
});
