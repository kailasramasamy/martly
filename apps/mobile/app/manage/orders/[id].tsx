import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { ConfirmDialog } from "../../../components/manage/ui/ConfirmDialog";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { OrderActionBar } from "../../../components/manage/orders/OrderActionBar";
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
  const [paymentSheet, setPaymentSheet] = useState(false);
  const canEdit = !!user && can(user.role, "orders", "edit");
  const hasActions = canEdit && !!order && (!!forwardStatus(order) || canCancel(order));

  return (
    <ManageStackScreen
      title={order ? `Order #${order.id.slice(0, 8)}` : "Order"}
      loading={detail.loading}
      error={detail.error}
      onRetry={detail.reload}
      refreshing={detail.refreshing}
      onRefresh={detail.refresh}
      actions={hasActions && order ? (
        <OrderActionBar order={order} running={detail.running} onAdvance={detail.setStatus} onCancel={() => setConfirmCancel(true)} />
      ) : undefined}
    >
      {order && (
        <OrderDetailBody
          order={order}
          canEdit={canEdit}
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
      <ConfirmDialog
        visible={confirmCancel}
        title="Cancel this order?"
        message="This releases reserved stock and cannot be undone."
        confirmLabel="Yes, cancel order"
        cancelLabel="Keep order"
        running={detail.running}
        onConfirm={async () => { await detail.setStatus("CANCELLED"); setConfirmCancel(false); }}
        onClose={() => setConfirmCancel(false)}
      />
    </ManageStackScreen>
  );
}
