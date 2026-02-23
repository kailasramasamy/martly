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
import { api } from "../../lib/api";
import { colors, spacing, fontSize } from "../../constants/theme";
import { OrderCardSkeleton } from "../../components/SkeletonLoader";

interface OrderItem {
  id: string;
  quantity: number;
}

interface Order {
  id: string;
  status: string;
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          <Text style={styles.emptyText}>No orders yet</Text>
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
                <Text style={styles.detail}>{itemCount} item{itemCount !== 1 ? "s" : ""}</Text>
                <Text style={styles.detail}>{date}</Text>
              </View>
              <Text style={styles.total}>${Number(item.totalAmount).toFixed(2)}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  skeletonContainer: { padding: spacing.md },
  list: { padding: spacing.md },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary },
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
  total: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.primary },
});
