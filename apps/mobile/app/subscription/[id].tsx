import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast-context";
import { colors, spacing, fontSize, fonts } from "../../constants/theme";
import type { Subscription, Pricing } from "../../lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FREQUENCY_OPTIONS: { value: Subscription["frequency"]; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "ALTERNATE_DAYS", label: "Alternate Days" },
  { value: "SPECIFIC_DAYS", label: "Specific Days" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 Wks" },
  { value: "MONTHLY", label: "Monthly" },
];

const STATUS_COLORS: Record<Subscription["status"], string> = {
  ACTIVE: colors.success,
  PAUSED: colors.warning,
  CANCELLED: colors.error,
};

interface CalendarDay {
  date: string;
  scheduled: boolean;
  skipped: boolean;
}

interface SubscriptionDetail extends Subscription {
  calendar?: CalendarDay[];
  recentOrders?: { id: string; status: string; totalAmount: string; createdAt: string }[];
}

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { show } = useToast();

  const [subscription, setSubscription] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<SubscriptionDetail>(`/api/v1/subscriptions/${id}`);
      setSubscription(res.data);
    } catch {
      show("Failed to load subscription", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, show]);

  useFocusEffect(
    useCallback(() => {
      fetchSubscription();
    }, [fetchSubscription]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSubscription();
  }, [fetchSubscription]);

  const patchSubscription = async (body: Record<string, unknown>) => {
    if (!id) return;
    setUpdating(true);
    try {
      await api.patch(`/api/v1/subscriptions/${id}`, body);
      await fetchSubscription();
      show("Subscription updated", "success");
    } catch (e: any) {
      show(e.message || "Failed to update", "error");
    } finally {
      setUpdating(false);
    }
  };

  // ── Quantity change ────────────────────────────────────
  const handleQuantityChange = (itemIndex: number, delta: number) => {
    if (!subscription) return;
    const items = subscription.items.map((item, i) => ({
      storeProductId: item.storeProductId,
      quantity: i === itemIndex ? Math.max(1, item.quantity + delta) : item.quantity,
    }));
    patchSubscription({ items });
  };

  // ── Frequency change ───────────────────────────────────
  const handleFrequencyChange = (frequency: Subscription["frequency"]) => {
    if (!subscription || subscription.status === "CANCELLED") return;
    const body: Record<string, unknown> = { frequency };
    if (frequency === "SPECIFIC_DAYS") {
      body.selectedDays = subscription.selectedDays.length > 0 ? subscription.selectedDays : [new Date().getDay()];
    } else if (frequency === "WEEKLY" || frequency === "BIWEEKLY") {
      body.selectedDays = subscription.selectedDays.length > 0 ? [subscription.selectedDays[0]] : [new Date().getDay()];
    } else if (frequency === "MONTHLY") {
      body.selectedDays = subscription.selectedDays.length > 0 && subscription.selectedDays[0] >= 1 && subscription.selectedDays[0] <= 28
        ? [subscription.selectedDays[0]] : [new Date().getDate() > 28 ? 28 : new Date().getDate()];
    }
    patchSubscription(body);
  };

  // ── Day toggle ─────────────────────────────────────────
  const handleDayToggle = (dayIndex: number) => {
    if (!subscription || subscription.status === "CANCELLED") return;
    // Single-select for WEEKLY/BIWEEKLY
    if (subscription.frequency === "WEEKLY" || subscription.frequency === "BIWEEKLY") {
      patchSubscription({ selectedDays: [dayIndex] });
      return;
    }
    const current = new Set(subscription.selectedDays);
    if (current.has(dayIndex)) {
      current.delete(dayIndex);
    } else {
      current.add(dayIndex);
    }
    if (current.size === 0) {
      show("Select at least one day", "error");
      return;
    }
    patchSubscription({ selectedDays: Array.from(current) });
  };

  // ── Month date select ──────────────────────────────────
  const handleMonthDateSelect = (dayOfMonth: number) => {
    if (!subscription || subscription.status === "CANCELLED") return;
    patchSubscription({ selectedDays: [dayOfMonth] });
  };

  // ── Skip / Unskip ─────────────────────────────────────
  const handleSkipToggle = async (day: CalendarDay) => {
    if (!id || !subscription || subscription.status === "CANCELLED") return;
    setUpdating(true);
    try {
      if (day.skipped) {
        await api.delete(`/api/v1/subscriptions/${id}/skip/${day.date}`);
      } else {
        await api.post(`/api/v1/subscriptions/${id}/skip`, { date: day.date });
      }
      await fetchSubscription();
      show(day.skipped ? "Delivery restored" : "Delivery skipped", "success");
    } catch (e: any) {
      show(e.message || "Failed to update", "error");
    } finally {
      setUpdating(false);
    }
  };

  // ── Pause / Resume ─────────────────────────────────────
  const handlePauseResume = () => {
    if (!subscription) return;
    const newStatus = subscription.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    patchSubscription({ status: newStatus });
  };

  // ── Cancel ─────────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert(
      "Cancel Subscription",
      "Are you sure you want to cancel this subscription? This cannot be undone.",
      [
        { text: "No, Keep It", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            if (!id) return;
            setUpdating(true);
            try {
              await api.delete(`/api/v1/subscriptions/${id}`);
              show("Subscription cancelled", "success");
              router.back();
            } catch (e: any) {
              show(e.message || "Failed to cancel", "error");
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  // ── Helpers ────────────────────────────────────────────
  const formatPrice = (amount: number) =>
    `\u20B9${Math.round(amount).toLocaleString("en-IN")}`;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const getCalendarDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return {
      day: DAY_LABELS[d.getDay()],
      date: d.getDate(),
    };
  };

  // ── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!subscription) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyText}>Subscription not found</Text>
      </View>
    );
  }

  const isCancelled = subscription.status === "CANCELLED";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      {/* ── Status Header ────────────────────────────── */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.storeName}>{subscription.store?.name || "Store"}</Text>
            <Text style={styles.createdDate}>
              Created {formatDate(subscription.createdAt)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[subscription.status] + "18" }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[subscription.status] }]} />
            <Text style={[styles.statusText, { color: STATUS_COLORS[subscription.status] }]}>
              {subscription.status}
            </Text>
          </View>
        </View>
        {subscription.pausedUntil && subscription.status === "PAUSED" && (
          <Text style={styles.pausedUntil}>
            Paused until {formatDate(subscription.pausedUntil)}
          </Text>
        )}
      </View>

      {/* ── Items List ────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {subscription.items.map((item, index) => {
          const pricing: Pricing | undefined = item.pricing;
          const lineTotal = pricing ? pricing.effectivePrice * item.quantity : 0;
          return (
            <View key={item.id} style={styles.itemRow}>
              {item.storeProduct.product.imageUrl ? (
                <Image source={{ uri: item.storeProduct.product.imageUrl }} style={styles.itemImage} />
              ) : (
                <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                  <Ionicons name="cube-outline" size={20} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.storeProduct.product.name}
                </Text>
                <Text style={styles.itemVariant}>
                  {item.storeProduct.variant.unitValue} {item.storeProduct.variant.unitType}
                </Text>
                {pricing && (
                  <View style={styles.priceRow}>
                    <Text style={styles.itemPrice}>{formatPrice(pricing.effectivePrice)}</Text>
                    {pricing.savingsAmount > 0 && pricing.originalPrice !== pricing.effectivePrice && (
                      <Text style={styles.itemMrp}>{formatPrice(pricing.originalPrice)}</Text>
                    )}
                  </View>
                )}
              </View>
              <View style={styles.quantityControls}>
                {!isCancelled && (
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => handleQuantityChange(index, -1)}
                    disabled={item.quantity <= 1 || updating}
                  >
                    <Ionicons name="remove" size={16} color={item.quantity <= 1 ? colors.border : colors.text} />
                  </TouchableOpacity>
                )}
                <Text style={styles.qtyText}>{item.quantity}</Text>
                {!isCancelled && (
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => handleQuantityChange(index, 1)}
                    disabled={updating}
                  >
                    <Ionicons name="add" size={16} color={colors.text} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.lineTotal}>{formatPrice(lineTotal)}</Text>
            </View>
          );
        })}
      </View>

      {/* ── Frequency Selector ────────────────────────── */}
      {!isCancelled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Frequency</Text>
          <View style={styles.chipRow}>
            {FREQUENCY_OPTIONS.map((opt) => {
              const isActive = subscription.frequency === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => handleFrequencyChange(opt.value)}
                  disabled={updating}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {(subscription.frequency === "SPECIFIC_DAYS" ||
            subscription.frequency === "WEEKLY" ||
            subscription.frequency === "BIWEEKLY") && (
            <View style={styles.dayRow}>
              {DAY_LABELS.map((label, i) => {
                const isSelected = subscription.selectedDays.includes(i);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayToggle, isSelected && styles.dayToggleActive]}
                    onPress={() => handleDayToggle(i)}
                    disabled={updating}
                  >
                    <Text style={[styles.dayToggleText, isSelected && styles.dayToggleTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {subscription.frequency === "MONTHLY" && (
            <View style={styles.monthGrid}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => {
                const isSelected = subscription.selectedDays[0] === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.monthCell, isSelected && styles.monthCellActive]}
                    onPress={() => handleMonthDateSelect(d)}
                    disabled={updating}
                  >
                    <Text style={[styles.monthCellText, isSelected && styles.monthCellTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── Calendar Strip ────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Deliveries</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarScroll}>
          {(subscription.calendar ?? []).map((day) => {
            const { day: dayLabel, date } = getCalendarDayLabel(day.date);
            const isScheduled = day.scheduled && !day.skipped;
            const isSkipped = day.scheduled && day.skipped;
            const tappable = day.scheduled && !isCancelled;
            return (
              <TouchableOpacity
                key={day.date}
                style={[
                  styles.calendarDay,
                  isScheduled && styles.calendarDayScheduled,
                  isSkipped && styles.calendarDaySkipped,
                ]}
                onPress={() => tappable && handleSkipToggle(day)}
                disabled={!tappable || updating}
                activeOpacity={tappable ? 0.6 : 1}
              >
                <Text
                  style={[
                    styles.calendarDayLabel,
                    isScheduled && styles.calendarDayLabelActive,
                    isSkipped && styles.calendarDayLabelSkipped,
                  ]}
                >
                  {dayLabel}
                </Text>
                <Text
                  style={[
                    styles.calendarDate,
                    isScheduled && styles.calendarDateActive,
                    isSkipped && styles.calendarDateSkipped,
                  ]}
                >
                  {date}
                </Text>
                {isScheduled && <View style={styles.scheduledDot} />}
                {isSkipped && (
                  <View style={styles.skippedLine} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.calendarLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Scheduled</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.textSecondary }]} />
            <Text style={styles.legendText}>Skipped</Text>
          </View>
          <Text style={styles.legendHint}>Tap to skip/restore</Text>
        </View>
      </View>

      {/* ── Delivery Address ──────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        <View style={styles.addressCard}>
          <Ionicons name="location-outline" size={20} color={colors.primary} />
          <Text style={styles.addressText}>{subscription.deliveryAddress}</Text>
        </View>
      </View>

      {/* ── Actions ───────────────────────────────────── */}
      {!isCancelled && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: subscription.status === "ACTIVE" ? colors.warning + "15" : colors.primary + "15" },
            ]}
            onPress={handlePauseResume}
            disabled={updating}
          >
            <Ionicons
              name={subscription.status === "ACTIVE" ? "pause-circle-outline" : "play-circle-outline"}
              size={22}
              color={subscription.status === "ACTIVE" ? colors.warning : colors.primary}
            />
            <Text
              style={[
                styles.actionBtnText,
                { color: subscription.status === "ACTIVE" ? colors.warning : colors.primary },
              ]}
            >
              {subscription.status === "ACTIVE" ? "Pause Subscription" : "Resume Subscription"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.error + "10" }]}
            onPress={handleCancel}
            disabled={updating}
          >
            <Ionicons name="close-circle-outline" size={22} color={colors.error} />
            <Text style={[styles.actionBtnText, { color: colors.error }]}>Cancel Subscription</Text>
          </TouchableOpacity>
        </View>
      )}

      {updating && (
        <View style={styles.updatingOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  // ── Header ────────────────────────────────────────
  headerCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  storeName: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.xl,
    color: colors.text,
  },
  createdDate: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.sm,
  },
  pausedUntil: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: colors.warning,
    marginTop: spacing.sm,
  },

  // ── Section ───────────────────────────────────────
  section: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  // ── Items ─────────────────────────────────────────
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  itemImagePlaceholder: {
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  itemName: {
    fontFamily: fonts.medium,
    fontSize: fontSize.md,
    color: colors.text,
  },
  itemVariant: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  itemPrice: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  itemMrp: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textDecorationLine: "line-through",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: spacing.sm,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.md,
    color: colors.text,
    minWidth: 20,
    textAlign: "center",
  },
  lineTotal: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.md,
    color: colors.text,
    minWidth: 52,
    textAlign: "right",
  },

  // ── Frequency chips ───────────────────────────────
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.primary + "15",
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
  },

  // ── Day toggles ───────────────────────────────────
  dayRow: {
    flexDirection: "row",
    marginTop: spacing.sm,
    justifyContent: "space-between",
  },
  dayToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  dayToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayToggleText: {
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  dayToggleTextActive: {
    color: "#fff",
  },

  // ── Month date grid ─────────────────────────────────
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  monthCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  monthCellActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthCellText: {
    fontFamily: fonts.medium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  monthCellTextActive: {
    color: "#fff",
  },

  // ── Calendar strip ────────────────────────────────
  calendarScroll: {
    flexDirection: "row",
  },
  calendarDay: {
    alignItems: "center",
    width: 42,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    position: "relative",
    marginRight: 4,
  },
  calendarDayScheduled: {
    backgroundColor: colors.primary + "12",
  },
  calendarDaySkipped: {
    backgroundColor: colors.textSecondary + "10",
  },
  calendarDayLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  calendarDayLabelActive: {
    color: colors.primary,
  },
  calendarDayLabelSkipped: {
    color: colors.textSecondary,
  },
  calendarDate: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
    color: colors.text,
    marginTop: 2,
  },
  calendarDateActive: {
    color: colors.primaryDark,
  },
  calendarDateSkipped: {
    color: colors.textSecondary,
    textDecorationLine: "line-through",
  },
  scheduledDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  skippedLine: {
    width: 16,
    height: 2,
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
    marginTop: 5,
  },
  calendarLegend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  legendHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: "auto",
    fontStyle: "italic",
  },

  // ── Address ───────────────────────────────────────
  addressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  addressText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 20,
  },

  // ── Actions ───────────────────────────────────────
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  actionBtnText: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.lg,
  },

  // ── Updating overlay ──────────────────────────────
  updatingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.4)",
  },
});
