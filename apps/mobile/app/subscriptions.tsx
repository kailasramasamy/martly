import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { colors, spacing, fontSize, fonts } from "../constants/theme";
import type { Subscription } from "../lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FREQUENCY_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  DAILY: { label: "Daily", bg: "#dbeafe", color: "#2563eb", icon: "refresh" },
  ALTERNATE_DAYS: { label: "Alternate Days", bg: "#fce7f3", color: "#db2777", icon: "swap-horizontal" },
  SPECIFIC_DAYS: { label: "", bg: "#f3e8ff", color: "#7c3aed", icon: "calendar" },
  WEEKLY: { label: "", bg: "#dcfce7", color: "#16a34a", icon: "repeat" },
  BIWEEKLY: { label: "", bg: "#fff7ed", color: "#ea580c", icon: "swap-horizontal" },
  MONTHLY: { label: "", bg: "#fdf2f8", color: "#c026d3", icon: "calendar-clear" },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dotColor: string }> = {
  ACTIVE: { label: "Active", bg: "#dcfce7", color: "#15803d", dotColor: "#22c55e" },
  PAUSED: { label: "Paused", bg: "#fef3c7", color: "#92400e", dotColor: "#f59e0b" },
  CANCELLED: { label: "Cancelled", bg: "#fee2e2", color: "#991b1b", dotColor: "#ef4444" },
};

const FULL_DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatFrequencyLabel(sub: Subscription): string {
  if (sub.frequency === "SPECIFIC_DAYS") {
    return sub.selectedDays
      .sort((a, b) => a - b)
      .map((d) => DAY_LABELS[d])
      .join("\u00b7");
  }
  if (sub.frequency === "WEEKLY") {
    return `${FULL_DAY_LABELS[sub.selectedDays[0]] ?? ""}s`;
  }
  if (sub.frequency === "BIWEEKLY") {
    return `${FULL_DAY_LABELS[sub.selectedDays[0]] ?? ""}s / 2wk`;
  }
  if (sub.frequency === "MONTHLY") {
    const day = sub.selectedDays[0] ?? 1;
    const suffix = day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th";
    return `${day}${suffix} of month`;
  }
  return FREQUENCY_CONFIG[sub.frequency]?.label ?? sub.frequency;
}

function formatNextDelivery(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  // Normalize to date-only comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  return `${dayName}, ${month} ${day}`;
}

export default function SubscriptionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<Subscription[]>(`/api/v1/subscriptions?storeId=${storeId}`);
      setSubscriptions(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useFocusEffect(
    useCallback(() => {
      fetchSubscriptions();
    }, [fetchSubscriptions]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const hasActive = useMemo(
    () => subscriptions.some((s) => s.status === "ACTIVE"),
    [subscriptions],
  );

  // Loading
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading subscriptions...</Text>
      </View>
    );
  }

  // Empty state
  if (subscriptions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIllustration}>
          <View style={styles.emptyCircleOuter}>
            <View style={styles.emptyCircleInner}>
              <Ionicons name="calendar-outline" size={40} color={colors.primary} />
            </View>
          </View>
          <View style={styles.emptyDotRow}>
            <View style={[styles.emptyDot, { backgroundColor: "#bbf7d0" }]} />
            <View style={[styles.emptyDot, { backgroundColor: "#86efac", width: 8, height: 8 }]} />
            <View style={[styles.emptyDot, { backgroundColor: "#4ade80" }]} />
          </View>
        </View>
        <Text style={styles.emptyTitle}>No subscriptions yet</Text>
        <Text style={styles.emptySubtitle}>
          Start your first subscription to get daily essentials delivered automatically
        </Text>
        <TouchableOpacity
          style={styles.getStartedBtn}
          onPress={() => router.push("/subscription-builder")}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.getStartedText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderItem = ({ item: sub }: { item: Subscription }) => {
    const freqConfig = FREQUENCY_CONFIG[sub.frequency] ?? FREQUENCY_CONFIG.DAILY;
    const statusConfig = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.ACTIVE;
    const freqLabel = formatFrequencyLabel(sub);
    const itemCount = sub._count?.items ?? sub.items?.length ?? 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/subscription/${sub.id}`)}
        activeOpacity={0.7}
      >
        {/* Top row: Store name + Status */}
        <View style={styles.cardHeader}>
          <View style={styles.storeRow}>
            <View style={styles.storeIconWrap}>
              <Ionicons name="storefront" size={13} color={colors.primary} />
            </View>
            <Text style={styles.storeName} numberOfLines={1}>
              {sub.store?.name ?? "Store"}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.dotColor }]} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Items list */}
        <View style={styles.itemsSection}>
          {(sub.items ?? []).slice(0, 3).map((item) => (
            <View key={item.id} style={styles.itemRow}>
              {item.storeProduct?.product?.imageUrl ? (
                <Image source={{ uri: item.storeProduct.product.imageUrl }} style={styles.itemThumb} />
              ) : (
                <View style={[styles.itemThumb, styles.itemThumbPlaceholder]}>
                  <Ionicons name="image-outline" size={14} color={colors.border} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.storeProduct?.product?.name ?? "Product"}</Text>
                <Text style={styles.itemVariant}>
                  {item.storeProduct?.variant?.name ?? `${item.storeProduct?.variant?.unitValue} ${item.storeProduct?.variant?.unitType}`}
                </Text>
              </View>
              <View style={styles.itemQtyBadge}>
                <Text style={styles.itemQtyText}>{"×"}{item.quantity}</Text>
              </View>
            </View>
          ))}
          {itemCount > 3 && (
            <Text style={styles.moreItemsText}>+{itemCount - 3} more item{itemCount - 3 !== 1 ? "s" : ""}</Text>
          )}
        </View>

        {/* Bottom row: Frequency + Next delivery */}
        <View style={styles.cardFooter}>
          <View style={[styles.freqBadge, { backgroundColor: freqConfig.bg }]}>
            <Ionicons name={freqConfig.icon as any} size={11} color={freqConfig.color} />
            <Text style={[styles.freqText, { color: freqConfig.color }]}>{freqLabel}</Text>
          </View>

          {sub.status === "ACTIVE" && (
            <View style={styles.nextDeliveryRow}>
              <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.nextDeliveryText}>
                {formatNextDelivery(sub.nextDeliveryDate)}
              </Text>
            </View>
          )}

          {sub.status === "PAUSED" && sub.pausedUntil && (
            <View style={styles.nextDeliveryRow}>
              <Ionicons name="pause-circle-outline" size={12} color="#d97706" />
              <Text style={[styles.nextDeliveryText, { color: "#d97706" }]}>
                Until {formatNextDelivery(sub.pausedUntil)}
              </Text>
            </View>
          )}
        </View>

        {/* Tap indicator */}
        <View style={styles.chevronWrap}>
          <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={subscriptions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          hasActive ? (
            <TouchableOpacity
              style={styles.tomorrowBanner}
              onPress={() => router.push("/tomorrows-basket")}
              activeOpacity={0.8}
            >
              <View style={styles.tomorrowIconWrap}>
                <Ionicons name="basket" size={20} color="#fff" />
              </View>
              <View style={styles.tomorrowContent}>
                <Text style={styles.tomorrowTitle}>Tomorrow's Basket</Text>
                <Text style={styles.tomorrowSubtitle}>
                  Review and customize what's coming tomorrow
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
            </TouchableOpacity>
          ) : null
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/subscription-builder")}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8faf9",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8faf9",
    padding: 32,
  },
  loadingText: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginTop: 12,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8faf9",
    padding: 40,
  },
  emptyIllustration: {
    alignItems: "center",
    marginBottom: 28,
  },
  emptyCircleOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.primary + "10",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCircleInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  emptyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  getStartedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  getStartedText: {
    fontSize: fontSize.lg,
    fontFamily: fonts.bold,
    color: "#fff",
  },

  // List
  listContent: {
    padding: spacing.md,
  },

  // Tomorrow's Basket banner
  tomorrowBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary + "0D",
    borderWidth: 1,
    borderColor: colors.primary + "25",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  tomorrowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  tomorrowContent: {
    flex: 1,
  },
  tomorrowTitle: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  tomorrowSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Subscription card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    position: "relative",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 12,
  },
  storeIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.primary + "12",
    justifyContent: "center",
    alignItems: "center",
  },
  storeName: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
  },

  // Items
  itemsSection: {
    marginBottom: 14,
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  itemThumbPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  itemVariant: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 1,
  },
  itemQtyBadge: {
    backgroundColor: colors.primary + "12",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  itemQtyText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  moreItemsText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginTop: 2,
    paddingLeft: 46,
  },

  // Footer
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  freqBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  freqText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
  },
  nextDeliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nextDeliveryText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },

  // Chevron
  chevronWrap: {
    position: "absolute",
    right: 14,
    top: "50%",
    marginTop: -8,
  },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
});
