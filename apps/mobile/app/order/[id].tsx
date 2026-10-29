import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { useOrderWebSocket } from "../../lib/useOrderWebSocket";
import { useToast } from "../../lib/toast-context";
import { useLanguage } from "../../lib/language-context";
import { strings } from "../../lib/i18n";
import { useStrings } from "../../lib/i18n/use-strings";
import { colors, fonts } from "../../constants/theme";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { useReorder } from "../../components/orders/use-reorder";
import { OrderDetailSkeleton } from "../../components/SkeletonLoader";
import { withSignIn } from "../../components/SignInPrompt";
import { PickupNotice } from "../../components/order/PickupNotice";
import { ReturnStatusCard } from "../../components/order/ReturnStatusCard";
import { StatusCard } from "../../components/order/StatusCard";
import { CompletePayment } from "../../components/order/CompletePayment";
import { ItemsCard } from "../../components/order/ItemsCard";
import { OrderSummaryCard } from "../../components/order/OrderSummaryCard";
import { RateOrderSheet } from "../../components/order/RateOrderSheet";
import { BuyAgainSheet } from "../../components/order/BuyAgainSheet";
import { useOrderRatings } from "../../components/order/use-order-ratings";
import { SaveAsMonthlyList } from "../../components/monthly-list/SaveAsMonthlyList";
import { useStore } from "../../lib/store-context";
import type { OrderData } from "../../components/order/types";
import { awaitingPayment } from "@martly/shared/order-flow";
import type { ReturnRequestData } from "../../lib/types";

/** The order, kept live over the websocket while it's open, plus its return request once delivered */
function useOrder(id: string) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [returnRequest, setReturnRequest] = useState<ReturnRequestData | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await api.get<OrderData>(`/api/v1/orders/${id}`);
      setOrder(res.data);
    } catch {
      // the screen shows "Order not found"
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReturn = useCallback(() => {
    api.get<ReturnRequestData | null>(`/api/v1/return-requests/my-requests/${id}`).then((res) => { if (res.data) setReturnRequest(res.data); }).catch(() => {});
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);
  const delivered = order?.status === "DELIVERED";
  // Re-read on focus so a return submitted from the return screen shows up here
  useFocusEffect(useCallback(() => { if (delivered) fetchReturn(); }, [delivered, fetchReturn]));

  const isActive = !!order && order.status !== "DELIVERED" && order.status !== "CANCELLED";
  useOrderWebSocket({ orderId: id, enabled: isActive, onOrderUpdated: useCallback((_id: string, data: unknown) => setOrder(data as OrderData), []) });
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(fetchOrder, 60000);
    return () => clearInterval(interval);
  }, [isActive, fetchOrder]);

  return { order, loading, returnRequest, fetchOrder, fetchReturn, isActive };
}

function useCancel(order: OrderData | null, onCancelled: () => Promise<void>) {
  const toast = useToast();
  const t = useStrings("orders").detail;
  const [asking, setAsking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const paidOnline = order?.paymentMethod === "ONLINE" && order?.paymentStatus === "PAID";
  const message = paidOnline ? t.cancelAskOnline : Number(order?.walletAmountUsed ?? 0) > 0 ? t.cancelAskWallet : t.cancelAsk;

  const confirm = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      await api.post(`/api/v1/orders/${order.id}/cancel`, {});
      setAsking(false);
      await onCancelled();
    } catch (err: unknown) {
      toast.show(err instanceof Error ? err.message : t.cancelFailed, "error");
    } finally {
      setCancelling(false);
    }
  };
  return { asking, setAsking, cancelling, message, confirm };
}

function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useStrings("orders").detail;
  const r = useStrings("orders").reorder;
  const { getLocalizedName } = useLanguage();
  const insets = useSafeAreaInsets();
  const reorder = useReorder();
  const { order, loading, returnRequest, fetchOrder, fetchReturn, isActive } = useOrder(id);
  const ratings = useOrderRatings(order);
  const cancel = useCancel(order, fetchOrder);
  const [rating, setRating] = useState(false);
  const { selectedStore } = useStore();
  const ml = useStrings("monthlyList");

  if (loading) return <OrderDetailSkeleton />;
  if (!order) return <View style={styles.center}><Text style={styles.empty}>{t.notFound}</Text></View>;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        <StatusCard order={order} returnRequest={returnRequest} />
        {awaitingPayment(order) && <CompletePayment order={order} onPaid={fetchOrder} />}
        {isActive && order.pickups && order.pickups.length > 0 && <View style={styles.inset}><PickupNotice pickups={order.pickups} /></View>}
        <ItemsCard
          order={order}
          returnRequest={returnRequest}
          actions={{
            reordering: reorder.reorderingId === order.id, cancelling: cancel.cancelling, rated: ratings.storeRating?.overallRating ?? null,
            onReorder: () => reorder.reorder(order.id), onCancel: () => cancel.setAsking(true), onRate: () => setRating(true),
          }}
        />
        {returnRequest && (
          <View style={styles.inset}>
            <ReturnStatusCard orderId={order.id} status={order.status} statusLogs={order.statusLogs} request={returnRequest} onChanged={fetchReturn} />
          </View>
        )}
        {order.status === "DELIVERED" && order.storeId === selectedStore?.id && (
          <View style={styles.inset}>
            <SaveAsMonthlyList storeId={order.storeId} from={{ source: "ORDER", orderId: order.id }} label={ml.fromOrder} />
          </View>
        )}
        <OrderSummaryCard order={order} />
      </ScrollView>
      <BuyAgainSheet choices={reorder.choices} onAdd={reorder.addPicked} onClose={reorder.closeChoices} />
      <RateOrderSheet visible={rating} order={order} ratings={ratings} onClose={() => setRating(false)} />
      <ConfirmSheet
        visible={cancel.asking} title={t.cancelTitle} message={cancel.message} icon="close-circle-outline" iconColor="#ef4444"
        confirmLabel={t.cancelConfirm} loading={cancel.cancelling} onConfirm={cancel.confirm}
        onCancel={() => { if (!cancel.cancelling) cancel.setAsking(false); }}
      />
      <ConfirmSheet
        visible={reorder.pending !== null} title={r.replaceCartTitle}
        message={r.replaceCartMessage(reorder.pending ? getLocalizedName(reorder.pending.store) : undefined)}
        icon="cart-outline" iconColor={colors.primary} confirmLabel={r.replaceCart}
        onConfirm={reorder.confirmReplace} onCancel={reorder.dismissReplace}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { fontSize: 16, fontFamily: fonts.medium, color: colors.textSecondary },
  inset: { marginHorizontal: 16, marginTop: 12 },
});

export default withSignIn(OrderDetailScreen, "receipt-outline", () => ({
  title: strings("orders").detail.signInTitle,
  message: strings("orders").detail.signInMessage,
}));
