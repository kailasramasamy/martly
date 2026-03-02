import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { colors, spacing, fontSize, borderRadius, fonts } from "../../constants/theme";

interface TripOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress: string | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
}

interface Trip {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  store: {
    id: string;
    name: string;
    address: string;
  };
  orders: TripOrder[];
}

interface TripStats {
  total: number;
  active: number;
  completed: number;
  totalOrders: number;
}

function computeStats(trips: Trip[]): TripStats {
  let active = 0;
  let completed = 0;
  let totalOrders = 0;

  for (const trip of trips) {
    if (trip.status === "COMPLETED") completed++;
    else if (trip.status === "IN_PROGRESS") active++;
    totalOrders += trip.orders.length;
  }

  return { total: trips.length, active, completed, totalOrders };
}

function getStatusStyle(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case "CREATED":
      return { bg: "#dbeafe", text: "#1d4ed8", label: "Ready" };
    case "IN_PROGRESS":
      return { bg: "#fef3c7", text: "#b45309", label: "Active" };
    case "COMPLETED":
      return { bg: "#dcfce7", text: "#15803d", label: "Done" };
    case "CANCELLED":
      return { bg: "#fee2e2", text: "#b91c1c", label: "Cancelled" };
    default:
      return { bg: "#f1f5f9", text: "#475569", label: status };
  }
}

type Period = "today" | "history";

export default function DeliveriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("today");

  const fetchTrips = useCallback(async (p: Period) => {
    try {
      const query = p === "history" ? "?period=history" : "";
      const res = await api.get<Trip[]>(`/api/v1/rider-location/my-trips${query}`);
      setTrips(res.data ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchTrips(period);
    }, [fetchTrips, period])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTrips(period);
  }, [fetchTrips, period]);

  const switchPeriod = useCallback((p: Period) => {
    if (p === period) return;
    setPeriod(p);
    setLoading(true);
    fetchTrips(p);
  }, [period, fetchTrips]);

  const stats = computeStats(trips);

  const renderTrip = useCallback(({ item }: { item: Trip }) => {
    const statusStyle = getStatusStyle(item.status);
    const deliveredCount = item.orders.filter((o) => o.status === "DELIVERED").length;
    const isActive = item.status === "IN_PROGRESS" || item.status === "CREATED";

    return (
      <Pressable
        style={[styles.tripCard, isActive && styles.tripCardActive]}
        onPress={() => router.push(`/trip/${item.id}`)}
      >
        <View style={styles.tripHeader}>
          <View style={styles.tripHeaderLeft}>
            <View style={styles.storeIconBg}>
              <Ionicons name="storefront" size={16} color={colors.primary} />
            </View>
            <View style={styles.tripHeaderInfo}>
              <Text style={styles.storeName} numberOfLines={1}>{item.store.name}</Text>
              <Text style={styles.storeAddress} numberOfLines={1}>{item.store.address}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            {item.status === "IN_PROGRESS" && <View style={styles.liveDot} />}
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
          </View>
        </View>

        <View style={styles.tripDivider} />

        {period === "history" && item.completedAt && (
          <View style={styles.tripDateRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.tripDateText}>
              {new Date(item.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
        )}

        <View style={styles.tripMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="cube-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              {deliveredCount}/{item.orders.length} delivered
            </Text>
          </View>
          {item.orders.length > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                {"\u20B9"}
                {item.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0).toLocaleString("en-IN")}
              </Text>
            </View>
          )}
        </View>

        {/* Order address previews */}
        {item.orders.slice(0, 2).map((order) => (
          <View key={order.id} style={styles.orderPreview}>
            <View style={styles.orderDot} />
            <Text style={styles.orderPreviewText} numberOfLines={1}>
              {order.customer?.name ?? "Customer"} - {order.deliveryAddress ?? "No address"}
            </Text>
            {order.paymentMethod === "COD" && (
              <View style={styles.codBadge}>
                <Text style={styles.codText}>COD</Text>
              </View>
            )}
          </View>
        ))}
        {item.orders.length > 2 && (
          <Text style={styles.moreOrders}>+{item.orders.length - 2} more</Text>
        )}

        <View style={styles.tripFooter}>
          <Pressable
            style={[styles.tripButton, isActive && styles.tripButtonActive]}
            onPress={() => router.push(`/trip/${item.id}`)}
          >
            <Text style={[styles.tripButtonText, isActive && styles.tripButtonTextActive]}>
              {item.status === "CREATED" ? "Start Trip" : item.status === "IN_PROGRESS" ? "Continue" : "View Details"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isActive ? "#fff" : colors.primary}
            />
          </Pressable>
        </View>
      </Pressable>
    );
  }, [router, period]);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Deliveries</Text>
          <Text style={styles.headerSubtitle}>
            {period === "today" ? "Today's trips" : "Past trips"}
          </Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Period Tabs */}
      <View style={styles.periodTabs}>
        <Pressable
          style={[styles.periodTab, period === "today" && styles.periodTabActive]}
          onPress={() => switchPeriod("today")}
        >
          <Ionicons name="today-outline" size={16} color={period === "today" ? "#fff" : colors.textSecondary} />
          <Text style={[styles.periodTabText, period === "today" && styles.periodTabTextActive]}>Today</Text>
        </Pressable>
        <Pressable
          style={[styles.periodTab, period === "history" && styles.periodTabActive]}
          onPress={() => switchPeriod("history")}
        >
          <Ionicons name="time-outline" size={16} color={period === "history" ? "#fff" : colors.textSecondary} />
          <Text style={[styles.periodTabText, period === "history" && styles.periodTabTextActive]}>History</Text>
        </Pressable>
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, stats.active > 0 && styles.statValueActive]}>
            {stats.active}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.successDark }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalOrders}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
      </View>

      {/* Trip List */}
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={renderTrip}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name={period === "today" ? "bicycle-outline" : "archive-outline"} size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>
              {period === "today" ? "No trips today" : "No past trips"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {period === "today"
                ? "Pull down to refresh when trips are assigned"
                : "Your completed trips will appear here"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.heading,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },

  // Period tabs
  periodTabs: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: "#f1f5f9",
    borderRadius: borderRadius.md,
    padding: 3,
  },
  periodTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
  },
  periodTabActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  periodTabText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  periodTabTextActive: {
    color: "#fff",
  },

  // Stats
  statsCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: fontSize.title,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  statValueActive: {
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSize.caption,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  // Trip Card
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripCardActive: {
    borderColor: colors.primaryLight,
    borderWidth: 1.5,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tripHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.sm,
  },
  storeIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff7ed",
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  tripHeaderInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: fontSize.body,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  storeAddress: {
    fontSize: fontSize.caption,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 1,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    gap: 4,
  },
  statusText: {
    fontSize: fontSize.caption,
    fontFamily: fonts.semibold,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#f59e0b",
  },

  tripDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  tripDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: spacing.sm,
  },
  tripDateText: {
    fontSize: fontSize.caption,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },

  tripMeta: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },

  // Order previews
  orderPreview: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: spacing.sm,
  },
  orderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  orderPreviewText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  codBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: "#b45309",
  },
  moreOrders: {
    fontSize: fontSize.caption,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginLeft: 14,
    marginTop: 2,
  },

  // Footer
  tripFooter: {
    marginTop: spacing.sm,
  },
  tripButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: borderRadius.md,
    backgroundColor: "#fff7ed",
    gap: 4,
  },
  tripButtonActive: {
    backgroundColor: colors.primary,
  },
  tripButtonText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  tripButtonTextActive: {
    color: "#fff",
  },

  // Empty
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.subtitle,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
