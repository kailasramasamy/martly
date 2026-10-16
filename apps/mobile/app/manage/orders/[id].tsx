import { useState } from "react";
import { StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { can, hasPermission } from "@martly/shared/permissions";
import { Permission } from "@martly/shared/constants";
import { useAuth } from "../../../lib/auth-context";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { OrderActionBar } from "../../../components/manage/orders/OrderActionBar";
import { CANCEL_ORDER, ReasonSheet, UNDO_DELIVERY } from "../../../components/manage/orders/ReasonSheet";
import { Button } from "../../../components/manage/ui/Button";
import { useAdvanceStep } from "../../../components/manage/orders/use-advance-step";
import type { OrderDetail } from "../../../components/manage/orders/types";
import { canUndoDelivery } from "@martly/shared/order-flow";
import { OrderDetailBody } from "../../../components/manage/orders/OrderDetailBody";
import { PaymentStatusSheet } from "../../../components/manage/orders/PaymentStatusSheet";
import { canCancel, forwardStatus } from "../../../components/manage/orders/order-flow";
import { useOrderDetail } from "../../../components/manage/orders/use-order-detail";

export default function ManageOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const detail = useOrderDetail(id);
  const { data: order } = detail;
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [paymentSheet, setPaymentSheet] = useState(false);
  const canEdit = can(user, "orders", "edit");
  const canPay = user?.role === "SUPER_ADMIN" || hasPermission(user?.permissions, Permission.FINANCE_MANAGE);
  const hasActions = canEdit && !!order && (!!forwardStatus(order, user) || canCancel(order, user));
  const undoable = !!order && canUndoDelivery(user, order);
  const step = useAdvanceStep((_order: OrderDetail, status: string) => detail.setStatus(status), detail.reload, detail.running);

  return (
    <ManageStackScreen
      title={order ? `Order #${order.id.slice(0, 8)}` : "Order"}
      loading={detail.loading}
      error={detail.error}
      onRetry={detail.reload}
      refreshing={detail.refreshing}
      onRefresh={detail.refresh}
      actions={hasActions && order ? (
        <OrderActionBar order={order} running={detail.running} onAdvance={(status) => step.advance(order, status)} onCancel={() => setConfirmCancel(true)} />
      ) : undoable ? (
        <Button label="Undo delivery" variant="danger" icon="arrow-undo-outline" onPress={() => setConfirmUndo(true)} disabled={detail.running} style={styles.flex} />
      ) : undefined}
    >
      {order && (
        <OrderDetailBody
          order={order}
          canEdit={canPay}
          running={detail.running}
          onMarkPaid={() => detail.setPaymentStatus("PAID", "")}
          onChangePayment={() => setPaymentSheet(true)}
        />
      )}
      <PaymentStatusSheet
        visible={paymentSheet}
        current={order?.paymentStatus ?? ""}
        saving={detail.running}
        onClose={() => setPaymentSheet(false)}
        onSave={async (status, note) => { if (await detail.setPaymentStatus(status, note)) setPaymentSheet(false); }}
      />
      {step.overlays}
      <ReasonSheet
        preset={UNDO_DELIVERY}
        visible={confirmUndo}
        running={detail.running}
        onConfirm={async (reason) => { if (await detail.undoDelivery(reason)) setConfirmUndo(false); }}
        onClose={() => setConfirmUndo(false)}
      />
      <ReasonSheet
        preset={CANCEL_ORDER}
        visible={confirmCancel}
        running={detail.running}
        onConfirm={async (reason) => { await detail.setStatus("CANCELLED", reason); setConfirmCancel(false); }}
        onClose={() => setConfirmCancel(false)}
      />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
