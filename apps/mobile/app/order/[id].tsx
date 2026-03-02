import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useOrderWebSocket } from "../../lib/useOrderWebSocket";
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

interface StoreRatingData {
  id: string;
  overallRating: number;
  deliveryRating: number | null;
  packagingRating: number | null;
  comment: string | null;
}

interface MyReviewData {
  id: string;
  productId: string;
  rating: number;
  status: string;
}

interface OrderData {
  id: string;
  storeId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentType?: "DELIVERY" | "PICKUP";
  totalAmount: string;
  deliveryAddress: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemData[];
  statusLogs?: StatusLogData[];
  couponCode?: string | null;
  couponDiscount?: string | null;
  deliveryFee?: string | null;
  deliveryNotes?: string | null;
  walletAmountUsed?: string | null;
  loyaltyPointsUsed?: number | null;
  loyaltyPointsEarned?: number | null;
  scheduledDate?: string | null;
  slotStartTime?: string | null;
  slotEndTime?: string | null;
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

const RETURN_STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  APPROVED: "#22c55e",
  REJECTED: "#ef4444",
};

const RETURN_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Rating state
  const [existingStoreRating, setExistingStoreRating] = useState<StoreRatingData | null>(null);
  const [myReviews, setMyReviews] = useState<MyReviewData[]>([]);
  const [storeOverall, setStoreOverall] = useState(0);
  const [storeDelivery, setStoreDelivery] = useState(0);
  const [storePackaging, setStorePackaging] = useState(0);
  const [storeComment, setStoreComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [returnRequest, setReturnRequest] = useState<any>(null);

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

  // Fetch rating data when order is delivered
  useEffect(() => {
    if (!order || order.status !== "DELIVERED") return;

    // Fetch existing store rating
    api.get<StoreRatingData>(`/api/v1/store-ratings/order/${id}`).then((res) => {
      if (res.data) {
        setExistingStoreRating(res.data);
        setStoreOverall(res.data.overallRating);
        setStoreDelivery(res.data.deliveryRating ?? 0);
        setStorePackaging(res.data.packagingRating ?? 0);
        setStoreComment(res.data.comment ?? "");
      }
    }).catch(() => {});

    // Fetch existing product reviews
    const productIds = order.items.map((i) => i.productId).join(",");
    if (productIds) {
      api.get<MyReviewData[]>(`/api/v1/reviews/my-reviews?productIds=${productIds}`).then((res) => {
        if (res.data) setMyReviews(res.data);
      }).catch(() => {});
    }

    // Fetch existing return request
    api.get<any>(`/api/v1/return-requests/my-requests/${id}`).then((res) => {
      if (res.data) setReturnRequest(res.data);
    }).catch(() => {});
  }, [order?.status, order?.items, id]);

  // Re-fetch return request on screen focus (e.g. after submitting one)
  useFocusEffect(
    useCallback(() => {
      if (!order || order.status !== "DELIVERED") return;
      api.get<any>(`/api/v1/return-requests/my-requests/${id}`).then((res) => {
        if (res.data) setReturnRequest(res.data);
      }).catch(() => {});
    }, [order?.status, id])
  );

  const isActive = !!order && order.status !== "DELIVERED" && order.status !== "CANCELLED";

  // WebSocket for real-time updates on this order
  useOrderWebSocket({
    orderId: id,
    enabled: isActive,
    onOrderUpdated: useCallback((_orderId: string, data: unknown) => {
      setOrder(data as OrderData);
    }, []),
  });

  // 60s fallback poll for active orders (safety net)
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(fetchOrder, 60000);
    return () => clearInterval(interval);
  }, [isActive, fetchOrder]);

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

  const submitStoreRating = useCallback(async () => {
    if (storeOverall === 0 || !order) return;
    setSubmittingRating(true);
    try {
      const res = await api.post<StoreRatingData>("/api/v1/store-ratings", {
        orderId: id,
        storeId: order.storeId,
        overallRating: storeOverall,
        deliveryRating: storeDelivery || undefined,
        packagingRating: storePackaging || undefined,
        comment: storeComment.trim() || undefined,
      });
      setExistingStoreRating(res.data);
      toast.show("Thanks for your feedback!", "success");
    } catch (err: any) {
      toast.show(err?.message ?? "Failed to submit rating", "error");
    } finally {
      setSubmittingRating(false);
    }
  }, [storeOverall, storeDelivery, storePackaging, storeComment, order, id, toast]);

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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}>
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

      {/* Scheduled Slot */}
      {order.scheduledDate && order.slotStartTime && (
        <View style={styles.section}>
          <View style={styles.scheduledBanner}>
            <Ionicons name="calendar" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.scheduledLabel}>Scheduled {isPickup ? "Pickup" : "Delivery"}</Text>
              <Text style={styles.scheduledTime}>
                {new Date(order.scheduledDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                {", "}
                {(() => {
                  const formatTime = (t: string) => {
                    const [h, m] = t.split(":").map(Number);
                    const ampm = h >= 12 ? "PM" : "AM";
                    const h12 = h % 12 || 12;
                    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
                  };
                  return `${formatTime(order.slotStartTime!)} – ${formatTime(order.slotEndTime!)}`;
                })()}
              </Text>
            </View>
          </View>
        </View>
      )}

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

      {/* Rating Sections — only for DELIVERED orders */}
      {order.status === "DELIVERED" && (
        <>
          {/* Rate Your Experience */}
          <View style={styles.ratingSection}>
            <View style={styles.ratingSectionHeader}>
              <Ionicons name="storefront-outline" size={20} color={colors.primary} />
              <Text style={styles.ratingSectionTitle}>Rate Your Experience</Text>
            </View>
            {existingStoreRating ? (
              <View style={styles.ratingCard}>
                <Text style={styles.ratingCardLabel}>Thanks for your feedback!</Text>
                {[
                  { label: "Overall", value: existingStoreRating.overallRating },
                  { label: "Delivery", value: existingStoreRating.deliveryRating },
                  { label: "Packaging", value: existingStoreRating.packagingRating },
                ].map((row) => row.value != null && row.value > 0 ? (
                  <View key={row.label} style={styles.ratingRow}>
                    <Text style={styles.ratingRowLabel}>{row.label}</Text>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons key={s} name={s <= row.value! ? "star" : "star-outline"} size={18} color={s <= row.value! ? "#f59e0b" : "#d1d5db"} />
                      ))}
                    </View>
                  </View>
                ) : null)}
                {existingStoreRating.comment && (
                  <Text style={styles.ratingComment}>"{existingStoreRating.comment}"</Text>
                )}
              </View>
            ) : (
              <View style={styles.ratingCard}>
                {[
                  { label: "Overall", value: storeOverall, setter: setStoreOverall, required: true },
                  { label: "Delivery", value: storeDelivery, setter: setStoreDelivery },
                  { label: "Packaging", value: storePackaging, setter: setStorePackaging },
                ].map((row) => (
                  <View key={row.label} style={styles.ratingRow}>
                    <Text style={styles.ratingRowLabel}>
                      {row.label}
                      {row.required && <Text style={{ color: colors.error }}> *</Text>}
                    </Text>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <TouchableOpacity key={s} onPress={() => row.setter(s)} hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}>
                          <Ionicons name={s <= row.value ? "star" : "star-outline"} size={22} color={s <= row.value ? "#f59e0b" : "#d1d5db"} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
                <TextInput
                  style={styles.ratingInput}
                  value={storeComment}
                  onChangeText={setStoreComment}
                  placeholder="Any comments? (optional)"
                  placeholderTextColor="#94a3b8"
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.ratingSubmitBtn, storeOverall === 0 && { opacity: 0.4 }]}
                  onPress={submitStoreRating}
                  disabled={submittingRating || storeOverall === 0}
                >
                  {submittingRating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.ratingSubmitText}>Submit Rating</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Rate Your Products */}
          <View style={styles.ratingSection}>
            <View style={styles.ratingSectionHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
              <Text style={styles.ratingSectionTitle}>Rate Your Products</Text>
            </View>
            <View style={styles.ratingCard}>
              {order.items.map((item) => {
                const existing = myReviews.find((r) => r.productId === item.productId);
                return (
                  <View key={item.id} style={styles.productRatingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productRatingName} numberOfLines={1}>{item.product.name}</Text>
                      {item.variant && <Text style={styles.productRatingVariant}>{item.variant.name}</Text>}
                    </View>
                    {existing ? (
                      <View style={styles.reviewedBadgeRow}>
                        <View style={styles.starRow}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Ionicons key={s} name={s <= existing.rating ? "star" : "star-outline"} size={14} color={s <= existing.rating ? "#f59e0b" : "#d1d5db"} />
                          ))}
                        </View>
                        <View style={styles.reviewedBadge}>
                          <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                          <Text style={styles.reviewedBadgeText}>Reviewed</Text>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.writeReviewBtn}
                        onPress={() => router.push({
                          pathname: "/write-review",
                          params: { productId: item.productId, productName: item.product.name, storeId: order.storeId, orderId: id },
                        })}
                      >
                        <Ionicons name="create-outline" size={14} color={colors.primary} />
                        <Text style={styles.writeReviewBtnText}>Review</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
          {/* Return Request Section */}
          {returnRequest ? (
            <View style={styles.returnCard}>
              <View style={styles.returnCardHeader}>
                <Text style={styles.returnCardTitle}>Return Request</Text>
                <View style={[styles.returnBadge, { backgroundColor: RETURN_STATUS_COLORS[returnRequest.status] ?? colors.textSecondary }]}>
                  <Text style={styles.returnBadgeText}>{RETURN_STATUS_LABELS[returnRequest.status] ?? returnRequest.status}</Text>
                </View>
              </View>
              <Text style={styles.returnReason}>{returnRequest.reason}</Text>
              <View style={styles.returnAmountRow}>
                <Text style={styles.returnAmountLabel}>Requested Amount</Text>
                <Text style={styles.returnAmountValue}>{"\u20B9"}{Number(returnRequest.requestedAmount).toFixed(0)}</Text>
              </View>
              {returnRequest.status === "APPROVED" && (
                <>
                  <View style={styles.returnAmountRow}>
                    <Text style={styles.returnAmountLabel}>Approved Amount</Text>
                    <Text style={[styles.returnAmountValue, { color: "#22c55e" }]}>{"\u20B9"}{Number(returnRequest.approvedAmount).toFixed(0)}</Text>
                  </View>
                  {returnRequest.adminNote && (
                    <Text style={styles.returnAdminNote}>{returnRequest.adminNote}</Text>
                  )}
                </>
              )}
              {returnRequest.status === "REJECTED" && returnRequest.adminNote && (
                <Text style={styles.returnAdminNote}>{returnRequest.adminNote}</Text>
              )}
            </View>
          ) : (
            new Date().getTime() - new Date(order.updatedAt).getTime() < 48 * 60 * 60 * 1000 && (
              <TouchableOpacity
                style={styles.returnBtn}
                onPress={() => router.push({ pathname: "/return-request", params: { orderId: order.id } })}
                activeOpacity={0.7}
              >
                <Ionicons name="return-down-back-outline" size={18} color={colors.primary} />
                <Text style={styles.returnBtnText}>Request Return/Refund</Text>
              </TouchableOpacity>
            )
          )}
        </>
      )}

      {/* Get Help button */}
      <TouchableOpacity
        style={styles.helpBtn}
        onPress={() => router.push({ pathname: "/support-chat", params: { orderId: order.id } })}
        activeOpacity={0.7}
      >
        <Ionicons name="headset-outline" size={18} color={colors.primary} />
        <Text style={styles.helpBtnText}>Get Help with this Order</Text>
      </TouchableOpacity>

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
  scheduledBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.primary + "10",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + "30",
    padding: 12,
  },
  scheduledLabel: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "600",
  },
  scheduledTime: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  helpBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primary + "08",
  },
  helpBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: "600" },
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
  ratingSection: {
    marginBottom: spacing.lg,
  },
  ratingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.sm,
  },
  ratingSectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.text,
  },
  ratingCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  ratingCardLabel: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  ratingRowLabel: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
  },
  starRow: {
    flexDirection: "row",
    gap: 4,
  },
  ratingComment: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ratingInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    fontSize: fontSize.md,
    color: colors.text,
    marginTop: spacing.sm,
    minHeight: 60,
    textAlignVertical: "top",
  },
  ratingSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  ratingSubmitText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: "#fff",
  },
  productRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productRatingName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  productRatingVariant: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  reviewedBadgeRow: {
    alignItems: "flex-end",
    gap: 4,
  },
  reviewedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  reviewedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary,
  },
  writeReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  writeReviewBtnText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.primary,
  },
  returnCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  returnCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  returnCardTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  returnBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  returnBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: "#fff",
  },
  returnReason: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  returnAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  returnAmountLabel: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  returnAmountValue: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  returnAdminNote: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  returnBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primary + "08",
  },
  returnBtnText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});
