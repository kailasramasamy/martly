import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast-context";
import { colors, spacing, fontSize } from "../../constants/theme";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { OrderDetailSkeleton } from "../../components/SkeletonLoader";

interface OrderItemData {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  product: { name: string };
  variant?: { name: string; unitType: string; unitValue: string } | null;
}

interface StatusLogData {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface OrderData {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentType?: "DELIVERY" | "PICKUP";
  totalAmount: string;
  deliveryAddress: string | null;
  createdAt: string;
  items: OrderItemData[];
  statusLogs?: StatusLogData[];
  couponCode?: string | null;
  couponDiscount?: string | null;
  deliveryFee?: string | null;
  deliveryNotes?: string | null;
  walletAmountUsed?: string | null;
  loyaltyPointsUsed?: number | null;
  loyaltyPointsEarned?: number | null;
}

const DELIVERY_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
const PICKUP_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "DELIVERED"] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const PICKUP_STATUS_LABELS: Record<string, string> = {
  ...STATUS_LABELS,
  READY: "Ready for Pickup",
  DELIVERED: "Picked Up",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  PREPARING: "#06b6d4",
  READY: "#6366f1",
  OUT_FOR_DELIVERY: "#8b5cf6",
  DELIVERED: "#22c55e",
  CANCELLED: "#ef4444",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded to Wallet",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  PAID: "#22c55e",
  FAILED: "#ef4444",
  REFUNDED: "#3b82f6",
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await api.get<OrderData>(`/api/v1/orders/${id}`);
      setOrder(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Poll for active orders
  useEffect(() => {
    if (!order) return;
    const isActive = order.status !== "DELIVERED" && order.status !== "CANCELLED";
    if (!isActive) return;

    const interval = setInterval(fetchOrder, 15000);
    return () => clearInterval(interval);
  }, [order, fetchOrder]);

  const cancelMessage = (() => {
    const isOnlinePaid = order?.paymentMethod === "ONLINE" && order?.paymentStatus === "PAID";
    const hasWalletUsed = Number(order?.walletAmountUsed ?? 0) > 0;
    let msg = "Are you sure you want to cancel this order?";
    if (isOnlinePaid) {
      msg += "\n\nThe amount will be refunded to your Martly wallet.";
    } else if (hasWalletUsed) {
      msg += "\n\nThe wallet amount used will be refunded to your Martly wallet.";
    }
    return msg;
  })();

  const handleCancel = useCallback(() => {
    setShowCancelConfirm(true);
  }, []);

  const handleCancelConfirm = useCallback(async () => {
    setCancelling(true);
    try {
      await api.post(`/api/v1/orders/${id}/cancel`, {});
      setShowCancelConfirm(false);
      await fetchOrder();
    } catch (err: any) {
      toast.show(err?.message ?? "Failed to cancel order", "error");
    } finally {
      setCancelling(false);
    }
  }, [id, fetchOrder, toast]);

  if (loading) {
    return <OrderDetailSkeleton />;
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Order not found</Text>
      </View>
    );
  }

  const isCancelled = order.status === "CANCELLED";
  const isPickup = order.fulfillmentType === "PICKUP";
  const STATUSES = isPickup ? PICKUP_STATUSES : DELIVERY_STATUSES;
  const labels = isPickup ? PICKUP_STATUS_LABELS : STATUS_LABELS;
  const currentIdx = STATUSES.indexOf(order.status as (typeof STATUSES)[number]);

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container}>
      {/* Order ID + Status */}
      <View style={styles.header}>
        <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[order.status] ?? colors.textSecondary }]}>
          <Text style={styles.badgeText}>{labels[order.status] ?? order.status}</Text>
        </View>
      </View>

      {/* Status Progress / Timeline */}
      {isCancelled ? (
        <View style={styles.cancelledBox}>
          <Text style={styles.cancelledText}>This order has been cancelled</Text>
        </View>
      ) : order.statusLogs && order.statusLogs.length > 0 ? (
        <View style={styles.progressContainer}>
          {order.statusLogs.map((log, idx) => {
            const isLast = idx === order.statusLogs!.length - 1;
            return (
              <View key={log.id} style={styles.progressStep}>
                <View style={styles.progressRow}>
                  <View style={[styles.dot, styles.dotCompleted, isLast && styles.dotCurrent]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.progressLabel, styles.progressLabelCompleted, isLast && styles.progressLabelCurrent]}>
                      {labels[log.status] ?? log.status}
                    </Text>
                    <Text style={styles.timelineTime}>
                      {new Date(log.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    {log.note && <Text style={styles.timelineNote}>{log.note}</Text>}
                  </View>
                </View>
                {!isLast && <View style={[styles.line, styles.lineCompleted]} />}
              </View>
            );
          })}
          {/* Show remaining steps as gray */}
          {STATUSES.filter((s) => {
            const logStatuses = order.statusLogs!.map((l) => l.status);
            return !logStatuses.includes(s) && STATUSES.indexOf(s) > STATUSES.indexOf(order.statusLogs![order.statusLogs!.length - 1].status as any);
          }).map((status, idx, arr) => (
            <View key={status} style={styles.progressStep}>
              <View style={styles.progressRow}>
                <View style={styles.dot} />
                <Text style={styles.progressLabel}>{labels[status]}</Text>
              </View>
              {idx < arr.length - 1 && <View style={styles.line} />}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.progressContainer}>
          {STATUSES.map((status, idx) => {
            const isCompleted = idx <= currentIdx;
            const isCurr = idx === currentIdx;
            return (
              <View key={status} style={styles.progressStep}>
                <View style={styles.progressRow}>
                  <View style={[styles.dot, isCompleted && styles.dotCompleted, isCurr && styles.dotCurrent]} />
                  <Text style={[styles.progressLabel, isCompleted && styles.progressLabelCompleted, isCurr && styles.progressLabelCurrent]}>
                    {labels[status]}
                  </Text>
                </View>
                {idx < STATUSES.length - 1 && (
                  <View style={[styles.line, isCompleted && idx < currentIdx && styles.lineCompleted]} />
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Delivery Address / Pickup Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{isPickup ? "Pickup Location" : "Delivery Address"}</Text>
        <Text style={styles.address}>{order.deliveryAddress ?? "—"}</Text>
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.product.name}</Text>
              {item.variant && (
                <Text style={styles.itemVariant}>
                  {item.variant.name}
                </Text>
              )}
              <Text style={styles.itemQty}>{item.quantity} x ${Number(item.unitPrice).toFixed(2)}</Text>
            </View>
            <Text style={styles.itemPrice}>${Number(item.totalPrice).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Bill Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bill Summary</Text>
        {order.couponDiscount && Number(order.couponDiscount) > 0 && (
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Coupon ({order.couponCode})</Text>
            <Text style={styles.billSaving}>-{"\u20B9"}{Number(order.couponDiscount).toFixed(0)}</Text>
          </View>
        )}
        <View style={styles.billRow}>
          <Text style={styles.billLabel}>{isPickup ? "Fulfillment" : "Delivery fee"}</Text>
          {isPickup ? (
            <Text style={styles.billSaving}>Store Pickup - FREE</Text>
          ) : Number(order.deliveryFee ?? 0) > 0 ? (
            <Text style={styles.billValue}>{"\u20B9"}{Number(order.deliveryFee).toFixed(0)}</Text>
          ) : (
            <Text style={styles.billSaving}>FREE</Text>
          )}
        </View>
        {order.loyaltyPointsUsed && order.loyaltyPointsUsed > 0 && (
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Loyalty points used</Text>
            <Text style={styles.billSaving}>-{"\u20B9"}{order.loyaltyPointsUsed} ({order.loyaltyPointsUsed} pts)</Text>
          </View>
        )}
        {order.deliveryNotes && (
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>{isPickup ? "Pickup notes" : "Notes"}: {order.deliveryNotes}</Text>
          </View>
        )}
      </View>

      {/* Loyalty Points Earned */}
      {order.loyaltyPointsEarned && order.loyaltyPointsEarned > 0 && (
        <View style={styles.section}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#fffbeb",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#fde68a",
            padding: 12,
          }}>
            <Ionicons name="star" size={18} color="#d97706" />
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#92400e" }}>
              +{order.loyaltyPointsEarned} loyalty points earned
            </Text>
          </View>
        </View>
      )}

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{"\u20B9"}{Number(order.totalAmount).toFixed(0)}</Text>
      </View>

      {/* Payment Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment</Text>
        <View style={styles.paymentBreakdownCard}>
          {order.loyaltyPointsUsed != null && order.loyaltyPointsUsed > 0 && (
            <View style={styles.paymentBreakdownRow}>
              <View style={styles.paymentBreakdownLeft}>
                <View style={[styles.paymentBreakdownIcon, { backgroundColor: "#fffbeb" }]}>
                  <Ionicons name="star" size={14} color="#d97706" />
                </View>
                <Text style={styles.paymentBreakdownLabel}>Loyalty Points</Text>
              </View>
              <Text style={styles.paymentBreakdownAmount}>{"\u20B9"}{order.loyaltyPointsUsed}</Text>
            </View>
          )}
          {order.walletAmountUsed && Number(order.walletAmountUsed) > 0 && (
            <View style={styles.paymentBreakdownRow}>
              <View style={styles.paymentBreakdownLeft}>
                <View style={[styles.paymentBreakdownIcon, { backgroundColor: "#f0fdf4" }]}>
                  <Ionicons name="wallet" size={14} color="#16a34a" />
                </View>
                <Text style={styles.paymentBreakdownLabel}>Martly Wallet</Text>
              </View>
              <Text style={styles.paymentBreakdownAmount}>{"\u20B9"}{Number(order.walletAmountUsed).toFixed(0)}</Text>
            </View>
          )}
          {(() => {
            const walletUsed = Number(order.walletAmountUsed ?? 0);
            const loyaltyUsed = Number(order.loyaltyPointsUsed ?? 0);
            const total = Number(order.totalAmount);
            const paidViaMethod = total - walletUsed - loyaltyUsed;
            if (paidViaMethod > 0) {
              return (
                <View style={styles.paymentBreakdownRow}>
                  <View style={styles.paymentBreakdownLeft}>
                    <View style={[styles.paymentBreakdownIcon, { backgroundColor: "#eff6ff" }]}>
                      <Ionicons name={order.paymentMethod === "COD" ? "cash-outline" : "card-outline"} size={14} color="#3b82f6" />
                    </View>
                    <View>
                      <Text style={styles.paymentBreakdownLabel}>
                        {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"}
                      </Text>
                      <View style={[styles.paymentBadge, { backgroundColor: PAYMENT_STATUS_COLORS[order.paymentStatus] ?? "#94a3b8", alignSelf: "flex-start", marginTop: 4 }]}>
                        <Text style={styles.paymentBadgeText}>{PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.paymentBreakdownAmount}>{"\u20B9"}{paidViaMethod.toFixed(0)}</Text>
                </View>
              );
            }
            return null;
          })()}
          {(() => {
            const walletUsed = Number(order.walletAmountUsed ?? 0);
            const loyaltyUsed = Number(order.loyaltyPointsUsed ?? 0);
            const total = Number(order.totalAmount);
            if ((walletUsed + loyaltyUsed) >= total) {
              return (
                <View style={[styles.paymentBadge, { backgroundColor: PAYMENT_STATUS_COLORS[order.paymentStatus] ?? "#94a3b8", alignSelf: "flex-start", marginTop: 4 }]}>
                  <Text style={styles.paymentBadgeText}>{PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</Text>
                </View>
              );
            }
            return null;
          })()}
        </View>
      </View>

      {/* Date */}
      <Text style={styles.date}>
        Placed on {new Date(order.createdAt).toLocaleString()}
      </Text>

      {/* Cancel button — only for PENDING/CONFIRMED */}
      {(order.status === "PENDING" || order.status === "CONFIRMED") && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancel}
          disabled={cancelling}
          activeOpacity={0.7}
        >
          {cancelling ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.cancelBtnText}>Cancel Order</Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
    <ConfirmSheet
      visible={showCancelConfirm}
      title="Cancel Order"
      message={cancelMessage}
      icon="close-circle-outline"
      iconColor="#ef4444"
      confirmLabel="Yes, Cancel"
      loading={cancelling}
      onConfirm={handleCancelConfirm}
      onCancel={() => { if (!cancelling) setShowCancelConfirm(false); }}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  orderId: { fontSize: fontSize.xl, fontWeight: "bold", color: colors.text },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600" },
  cancelledBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cancelledText: { color: colors.error, fontWeight: "600", textAlign: "center" },
  progressContainer: {
    paddingLeft: spacing.sm,
    marginBottom: spacing.lg,
  },
  progressStep: {},
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginRight: spacing.sm,
  },
  dotCompleted: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dotCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  line: {
    width: 2,
    height: 20,
    backgroundColor: colors.border,
    marginLeft: 6,
  },
  lineCompleted: {
    backgroundColor: colors.primary,
  },
  progressLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  progressLabelCompleted: {
    color: colors.text,
  },
  progressLabelCurrent: {
    fontWeight: "bold",
    color: colors.primary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  address: { fontSize: fontSize.md, color: colors.textSecondary },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  itemVariant: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 1 },
  itemQty: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.text,
    marginBottom: spacing.md,
  },
  totalLabel: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.text },
  totalAmount: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.primary },
  date: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl },
  timelineTime: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 1 },
  timelineNote: { fontSize: fontSize.sm, color: colors.textSecondary, fontStyle: "italic", marginTop: 2 },
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  billLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  billValue: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  billSaving: { fontSize: fontSize.md, fontWeight: "600", color: "#22c55e" },
  paymentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  paymentBadgeText: { fontSize: fontSize.sm, fontWeight: "600", color: "#fff" },
  cancelBtn: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  cancelBtnText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
  paymentBreakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  paymentBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentBreakdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  paymentBreakdownIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  paymentBreakdownLabel: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  paymentBreakdownAmount: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
});
