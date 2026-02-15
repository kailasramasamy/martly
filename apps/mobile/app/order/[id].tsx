import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../lib/api";
import { colors, spacing, fontSize } from "../../constants/theme";

interface OrderItemData {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  product: { name: string };
  variant?: { name: string; unitType: string; unitValue: string } | null;
}

interface OrderData {
  id: string;
  status: string;
  totalAmount: string;
  deliveryAddress: string;
  createdAt: string;
  items: OrderItemData[];
}

const STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
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

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Order not found</Text>
      </View>
    );
  }

  const isCancelled = order.status === "CANCELLED";
  const currentIdx = STATUSES.indexOf(order.status as (typeof STATUSES)[number]);

  return (
    <ScrollView style={styles.container}>
      {/* Order ID + Status */}
      <View style={styles.header}>
        <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[order.status] ?? colors.textSecondary }]}>
          <Text style={styles.badgeText}>{STATUS_LABELS[order.status] ?? order.status}</Text>
        </View>
      </View>

      {/* Status Progress */}
      {isCancelled ? (
        <View style={styles.cancelledBox}>
          <Text style={styles.cancelledText}>This order has been cancelled</Text>
        </View>
      ) : (
        <View style={styles.progressContainer}>
          {STATUSES.map((status, idx) => {
            const isCompleted = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            return (
              <View key={status} style={styles.progressStep}>
                <View style={styles.progressRow}>
                  <View
                    style={[
                      styles.dot,
                      isCompleted && styles.dotCompleted,
                      isCurrent && styles.dotCurrent,
                    ]}
                  />
                  <Text
                    style={[
                      styles.progressLabel,
                      isCompleted && styles.progressLabelCompleted,
                      isCurrent && styles.progressLabelCurrent,
                    ]}
                  >
                    {STATUS_LABELS[status]}
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

      {/* Delivery Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        <Text style={styles.address}>{order.deliveryAddress}</Text>
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
                  {item.variant.name} · {item.variant.unitType} {item.variant.unitValue}
                </Text>
              )}
              <Text style={styles.itemQty}>{item.quantity} x ${Number(item.unitPrice).toFixed(2)}</Text>
            </View>
            <Text style={styles.itemPrice}>${Number(item.totalPrice).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>${Number(order.totalAmount).toFixed(2)}</Text>
      </View>

      {/* Date */}
      <Text style={styles.date}>
        Placed on {new Date(order.createdAt).toLocaleString()}
      </Text>
    </ScrollView>
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
});
