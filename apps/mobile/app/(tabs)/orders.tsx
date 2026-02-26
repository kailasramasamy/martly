import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast-context";
import { colors, spacing, fontSize } from "../../constants/theme";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { OrderCardSkeleton } from "../../components/SkeletonLoader";

interface OrderItem {
  id: string;
  quantity: number;
}

interface Order {
  id: string;
  status: string;
  fulfillmentType?: "DELIVERY" | "PICKUP";
  totalAmount: string;
  createdAt: string;
  items: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  PREPARING: "#06b6d4",
  READY: "#6366f1",
  OUT_FOR_DELIVERY: "#8b5cf6",
  DELIVERED: "#22c55e",
  CANCELLED: "#ef4444",
};

export default function OrdersScreen() {
  const router = useRouter();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.getList<Order>("/api/v1/orders");
      setOrders(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const handleCancelPress = useCallback((orderId: string) => {
    setCancelConfirm(orderId);
  }, []);

  const handleCancelConfirm = useCallback(async () => {
    if (!cancelConfirm) return;
    setCancelling(true);
    try {
      await api.post(`/api/v1/orders/${cancelConfirm}/cancel`, {});
      setCancelConfirm(null);
      fetchOrders();
    } catch (err: any) {
      toast.show(err?.message ?? "Failed to cancel order", "error");
    } finally {
      setCancelling(false);
    }
  }, [cancelConfirm, fetchOrders, toast]);

  if (loading) {
    return (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3, 4].map((i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={orders.length === 0 ? styles.center : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const itemCount = item.items.reduce((sum, i) => sum + i.quantity, 0);
          const date = new Date(item.createdAt).toLocaleDateString();
          const statusLabel = item.status.replace(/_/g, " ");

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/order/${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? colors.textSecondary }]}>
                  <Text style={styles.badgeText}>{statusLabel}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.detail}>{itemCount} item{itemCount !== 1 ? "s" : ""}</Text>
                  {item.fulfillmentType === "PICKUP" && (
                    <View style={styles.pickupBadge}>
                      <Ionicons name="storefront-outline" size={10} color={colors.primary} />
                      <Text style={styles.pickupBadgeText}>Pickup</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.detail}>{date}</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.total}>{"\u20B9"}{Number(item.totalAmount).toFixed(0)}</Text>
                {(item.status === "PENDING" || item.status === "CONFIRMED") && (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); handleCancelPress(item.id); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <ConfirmSheet
        visible={cancelConfirm !== null}
        title="Cancel Order"
        message="Are you sure you want to cancel this order?"
        icon="close-circle-outline"
        iconColor="#ef4444"
        confirmLabel="Yes, Cancel"
        loading={cancelling}
        onConfirm={handleCancelConfirm}
        onCancel={() => { if (!cancelling) setCancelConfirm(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  skeletonContainer: { padding: spacing.md },
  list: { padding: spacing.md },
  emptyContainer: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary },
  emptySignInBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 8, marginTop: 4,
  },
  emptySignInText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  orderId: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.text },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600", textTransform: "capitalize" },
  cardBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  detail: { fontSize: fontSize.md, color: colors.textSecondary },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  total: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.primary },
  cancelText: { fontSize: fontSize.sm, fontWeight: "600", color: "#ef4444" },
  pickupBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.primary + "14",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pickupBadgeText: { fontSize: 10, fontWeight: "600", color: colors.primary },
});
