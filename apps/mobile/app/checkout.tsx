import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useToast } from "../lib/toast-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth-context";
import { useCart } from "../lib/cart-context";
import { useStore } from "../lib/store-context";
import { api } from "../lib/api";
import { colors, spacing, fontSize } from "../constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Switch } from "react-native";
import { RazorpayCheckout } from "../components/RazorpayCheckout";
import { ProfileGate } from "../components/ProfileGate";
import type { FulfillmentType, UserAddress, CouponValidation, DeliveryZoneInfo, DeliveryLookupResult, LoyaltyData } from "../lib/types";

type PaymentMethod = "ONLINE" | "COD";
type DeliveryMode = "express" | "scheduled";

const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface AvailableSlot {
  id: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  available: number;
  full: boolean;
}

interface RazorpayData {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  customer_id?: string;
}

interface WalletData {
  balance: number;
  transactions: unknown[];
}

export default function CheckoutScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { storeId, storeName, items, totalAmount, itemCount } = useCart();
  const { selectedStore } = useStore();

  const minOrderAmount = selectedStore?.minOrderAmount ? Number(selectedStore.minOrderAmount) : null;
  const freeDeliveryThreshold = selectedStore?.freeDeliveryThreshold ? Number(selectedStore.freeDeliveryThreshold) : null;
  const belowMinimum = minOrderAmount != null && totalAmount < minOrderAmount;

  const [showProfileGate, setShowProfileGate] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ONLINE");
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponValidation | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [razorpayVisible, setRazorpayVisible] = useState(false);
  const [razorpayData, setRazorpayData] = useState<RazorpayData | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZoneInfo | null>(null);
  const [addressLookups, setAddressLookups] = useState<Record<string, DeliveryLookupResult>>({});
  const [lookingUpDelivery, setLookingUpDelivery] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("express");
  const [hasSlots, setHasSlots] = useState(false);
  const [expressConfig, setExpressConfig] = useState<{
    enabled: boolean; available: boolean; etaMinutes: number | null; reason?: string;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const deliveryLookup = selectedAddressId ? (addressLookups[selectedAddressId] ?? null) : null;
  const isPickup = fulfillmentType === "PICKUP";
  const isNotServiceable = deliveryLookup !== null && !deliveryLookup.serviceable;
  // Only disable delivery if NO address is serviceable
  const hasAnyServiceableAddress = addresses.some((a) => addressLookups[a.id]?.serviceable);
  const deliveryDisabled = Object.keys(addressLookups).length > 0 && !hasAnyServiceableAddress;

  const fetchAddresses = useCallback(async (selectNewest = false) => {
    setLoadingAddresses(true);
    try {
      const res = await api.get<UserAddress[]>("/api/v1/addresses");
      setAddresses(res.data);
      if (selectNewest && res.data.length > 0) {
        // Select the most recently created address (last in list by createdAt)
        const sorted = [...res.data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setSelectedAddressId(sorted[0].id);
      } else {
        // Pre-select default or first
        const defaultAddr = res.data.find((a) => a.isDefault);
        if (defaultAddr) setSelectedAddressId(defaultAddr.id);
        else if (res.data.length > 0) setSelectedAddressId(res.data[0].id);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAddresses();
    }, [fetchAddresses]),
  );

  // Fetch delivery zone (fallback)
  useEffect(() => {
    if (!storeId) return;
    api.get<DeliveryZoneInfo | null>(`/api/v1/delivery-zones/lookup?storeId=${storeId}`)
      .then((res) => { if (res.data) setDeliveryZone(res.data); })
      .catch(() => {});
  }, [storeId]);

  // Fetch wallet balance
  useEffect(() => {
    api.get<WalletData>("/api/v1/wallet")
      .then((res) => setWalletBalance(res.data.balance))
      .catch(() => {});
  }, []);

  // Fetch loyalty data
  useEffect(() => {
    if (!storeId) return;
    api.get<LoyaltyData>(`/api/v1/loyalty?storeId=${storeId}`)
      .then((res) => setLoyaltyData(res.data))
      .catch(() => {});
  }, [storeId]);

  // Fetch payment preferences (pre-select last used method)
  useEffect(() => {
    api.get<{ preferredPaymentMethod: string | null }>("/api/v1/orders/payment-preferences")
      .then((res) => {
        const pref = res.data.preferredPaymentMethod;
        if (pref === "ONLINE" || pref === "COD") setPaymentMethod(pref);
      })
      .catch(() => {});
  }, []);

  // Check if store has delivery slots + express config
  useEffect(() => {
    if (!storeId) return;
    api.get<{
      hasSlots: boolean;
      express: { enabled: boolean; available: boolean; etaMinutes: number | null; reason?: string };
    }>(`/api/v1/delivery-slots/check?storeId=${storeId}`)
      .then((res) => {
        setHasSlots(res.data.hasSlots);
        setExpressConfig(res.data.express);
      })
      .catch(() => {});
  }, [storeId]);

  // Fetch available slots when date changes
  useEffect(() => {
    if (!storeId || !selectedDate || deliveryMode !== "scheduled") return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    api.get<AvailableSlot[]>(`/api/v1/delivery-slots/available?storeId=${storeId}&date=${selectedDate}`)
      .then((res) => {
        setAvailableSlots(res.data);
        // Auto-select the first available (non-full) slot
        const firstAvailable = res.data.find((s) => !s.full);
        if (firstAvailable) setSelectedSlot(firstAvailable);
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [storeId, selectedDate, deliveryMode]);

  // Auto-select delivery mode based on express availability
  useEffect(() => {
    if (!expressConfig) return;
    if (!expressConfig.enabled || !expressConfig.available) {
      if (hasSlots) {
        setDeliveryMode("scheduled");
      }
    }
  }, [expressConfig, hasSlots]);

  // When switching to scheduled, auto-set today's date; when switching to express, clear slot
  useEffect(() => {
    if (deliveryMode === "scheduled") {
      if (!selectedDate) {
        setSelectedDate(toLocalDateStr(new Date()));
      }
    } else {
      setSelectedSlot(null);
    }
  }, [deliveryMode]);

  // Distance-based delivery lookup for all addresses
  useEffect(() => {
    if (!storeId || addresses.length === 0) return;

    const toFetch = addresses.filter(
      (a) => a.latitude != null && a.longitude != null && !addressLookups[a.id],
    );
    if (toFetch.length === 0) return;

    setLookingUpDelivery(true);
    Promise.all(
      toFetch.map((a) =>
        api.post<DeliveryLookupResult>("/api/v1/delivery-tiers/lookup", {
          storeId,
          latitude: a.latitude,
          longitude: a.longitude,
        })
          .then((res) => ({ id: a.id, result: res.data }))
          .catch(() => null),
      ),
    ).then((results) => {
      setAddressLookups((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r.id] = r.result;
        }
        return next;
      });
    }).finally(() => setLookingUpDelivery(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, addresses]);

  // When selected address is not serviceable, try switching to a serviceable one
  // Only auto-switch to pickup if NO address is serviceable
  useEffect(() => {
    if (!isNotServiceable || fulfillmentType !== "DELIVERY") return;

    // Try to find a serviceable address
    const serviceableAddr = addresses.find((a) => addressLookups[a.id]?.serviceable);
    if (serviceableAddr) {
      setSelectedAddressId(serviceableAddr.id);
    } else if (Object.keys(addressLookups).length > 0 && !hasAnyServiceableAddress) {
      setFulfillmentType("PICKUP");
    }
  }, [isNotServiceable, fulfillmentType, addresses, addressLookups, hasAnyServiceableAddress]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    setCouponError("");
    setCouponResult(null);
    try {
      const res = await api.post<CouponValidation>("/api/v1/coupons/validate", {
        code: couponCode.trim(),
        storeId,
        orderAmount: totalAmount,
      });
      setCouponResult(res.data);
    } catch (e: unknown) {
      setCouponError(e instanceof Error ? e.message : "Invalid coupon");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponResult(null);
    setCouponCode("");
    setCouponError("");
  };

  const couponDiscount = couponResult?.discount ?? 0;
  // Delivery fee resolution: distance tier > zone > store base fee > 0
  // Free delivery threshold waives the fee when item total meets threshold.
  const baseDeliveryFee = selectedStore?.baseDeliveryFee ? Number(selectedStore.baseDeliveryFee) : 0;
  const lookupOrZoneFee = deliveryLookup?.serviceable
    ? (deliveryLookup.deliveryFee ?? 0)
    : (deliveryZone?.deliveryFee ?? 0);
  const rawDeliveryFee = isPickup ? 0 : (lookupOrZoneFee || baseDeliveryFee);
  const freeDeliveryApplied = !isPickup && freeDeliveryThreshold != null && totalAmount >= freeDeliveryThreshold;
  const deliveryFee = freeDeliveryApplied ? 0 : rawDeliveryFee;
  const effectiveEstMinutes = isPickup
    ? 30
    : expressConfig?.etaMinutes != null && deliveryMode === "express"
      ? expressConfig.etaMinutes
      : deliveryLookup?.serviceable
        ? deliveryLookup.estimatedMinutes
        : deliveryZone?.estimatedMinutes;
  const grandTotal = totalAmount - couponDiscount + deliveryFee;
  const walletDeduction = useWallet ? Math.min(walletBalance, grandTotal) : 0;
  const afterWallet = grandTotal - walletDeduction;

  // Loyalty calculation
  const loyaltyConfig = loyaltyData?.config;
  const loyaltyBalance = loyaltyData?.balance?.points ?? 0;
  const loyaltyEnabled = loyaltyConfig?.isEnabled && loyaltyBalance >= (loyaltyConfig?.minRedeemPoints ?? Infinity);
  const loyaltyMaxByPercentage = loyaltyConfig ? Math.floor(grandTotal * loyaltyConfig.maxRedeemPercentage / 100) : 0;
  const loyaltyDeduction = useLoyalty && loyaltyEnabled
    ? Math.min(loyaltyBalance, afterWallet, loyaltyMaxByPercentage)
    : 0;
  const loyaltyEarnPreview = loyaltyConfig?.isEnabled && loyaltyConfig.earnRate > 0
    ? Math.floor(grandTotal / 100 * loyaltyConfig.earnRate)
    : 0;

  const amountToPay = afterWallet - loyaltyDeduction;
  const walletCoversAll = amountToPay === 0 && (walletDeduction > 0 || loyaltyDeduction > 0);
  // Order can proceed for pickup always; for delivery only if serviceable (or no lookup done)
  const orderDisabled = submitting || (!isPickup && isNotServiceable) || belowMinimum;

  const navigateToSuccess = (orderId: string, params: Record<string, string> = {}) => {
    router.replace({
      pathname: `/order-success/${orderId}`,
      params: { paymentMethod, fulfillmentType, ...params },
    });
  };

  const handlePaymentSuccess = async (data: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
    setRazorpayVisible(false);
    try {
      await api.post(`/api/v1/orders/${pendingOrderId}/payment/verify`, data);
    } catch {
      // verification pending — still show success
    }
    navigateToSuccess(pendingOrderId!);
  };

  const handlePaymentCancel = () => {
    setRazorpayVisible(false);
    // Order exists but unpaid — still navigate to success (payment pending)
    navigateToSuccess(pendingOrderId!);
  };

  const handlePlaceOrder = async () => {
    // For delivery, require address — show ProfileGate if none saved
    if (!isPickup && !selectedAddressId) {
      setShowProfileGate(true);
      return;
    }

    setSubmitting(true);
    try {
      const orderPayload: Record<string, unknown> = {
        storeId,
        fulfillmentType,
        paymentMethod: walletCoversAll ? "ONLINE" : paymentMethod,
        useWallet,
        useLoyaltyPoints: useLoyalty && loyaltyDeduction > 0,
        items: items.map((i) => ({
          storeProductId: i.storeProductId,
          quantity: i.quantity,
        })),
      };

      // Only include address fields for delivery orders
      if (!isPickup && selectedAddressId) {
        orderPayload.addressId = selectedAddressId;

        // Include delivery coordinates for distance-based fee calculation
        const selectedAddr = addresses.find((a) => a.id === selectedAddressId);
        if (selectedAddr?.latitude != null && selectedAddr?.longitude != null) {
          orderPayload.deliveryAddressLat = selectedAddr.latitude;
          orderPayload.deliveryAddressLng = selectedAddr.longitude;
        }
      }

      if (couponResult?.code) orderPayload.couponCode = couponResult.code;
      if (deliveryNotes.trim()) orderPayload.deliveryNotes = deliveryNotes.trim();

      if (deliveryMode === "scheduled" && selectedSlot && selectedDate) {
        orderPayload.deliverySlotId = selectedSlot.id;
        orderPayload.scheduledDate = selectedDate;
      }

      const result = await api.post<{ id: string; walletFullyCovered?: boolean }>("/api/v1/orders", orderPayload);
      const orderId = result.data.id;
      const fullyCoveredByWallet = result.data.walletFullyCovered === true;

      // Wallet fully covered — no further payment needed
      if (fullyCoveredByWallet) {
        navigateToSuccess(orderId, { walletPaid: "true" });
        return;
      }

      if (paymentMethod === "COD") {
        // Save COD preference (fire-and-forget)
        api.patch("/api/v1/orders/payment-preferences", { preferredPaymentMethod: "COD" }).catch(() => {});
        navigateToSuccess(orderId);
        return;
      }

      // Online payment — create Razorpay order and open in-app checkout
      try {
        const payRes = await api.post<RazorpayData>(`/api/v1/orders/${orderId}/payment`, {});
        setPendingOrderId(orderId);
        setRazorpayData(payRes.data);
        setRazorpayVisible(true);
      } catch (payErr: unknown) {
        // Payment gateway unavailable — order still created, show success (payment pending)
        navigateToSuccess(orderId);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to place order";
      toast.show(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Delivery fee preview text for fulfillment cards
  const deliveryFeePreview = lookingUpDelivery
    ? "Calculating..."
    : freeDeliveryApplied
      ? "FREE"
      : deliveryLookup?.serviceable
        ? deliveryLookup.deliveryFee
          ? `\u20B9${deliveryLookup.deliveryFee.toFixed(0)}`
          : "FREE"
        : deliveryZone?.deliveryFee
          ? `\u20B9${deliveryZone.deliveryFee.toFixed(0)}`
          : "FREE";

  const deliveryEtaPreview = deliveryLookup?.serviceable
    ? deliveryLookup.estimatedMinutes
      ? `${deliveryLookup.estimatedMinutes} min`
      : null
    : deliveryZone?.estimatedMinutes
      ? `${deliveryZone.estimatedMinutes} min`
      : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Store Info */}
        <View style={styles.storeCard}>
          <View style={styles.storeIconWrap}>
            <Ionicons name="storefront" size={18} color={colors.primary} />
          </View>
          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{storeName}</Text>
            <Text style={styles.storeItemCount}>{itemCount} item{itemCount !== 1 ? "s" : ""}</Text>
          </View>
        </View>

        {/* Min order warning */}
        {belowMinimum && (
          <View style={styles.minOrderWarning}>
            <Ionicons name="alert-circle" size={18} color="#c2410c" />
            <Text style={styles.minOrderWarningText}>
              Add {"\u20B9"}{(minOrderAmount! - totalAmount).toFixed(0)} more to place your order (min {"\u20B9"}{minOrderAmount!.toFixed(0)})
            </Text>
          </View>
        )}

        {/* Order Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>Order Summary</Text>
          </View>
          <View style={styles.itemsCard}>
            {items.map((item, index) => (
              <View
                key={item.storeProductId}
                style={[styles.itemRow, index < items.length - 1 && styles.itemRowBorder]}
              >
                <View style={styles.itemQtyBadge}>
                  <Text style={styles.itemQtyText}>{item.quantity}x</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
                  <Text style={styles.itemVariant}>{item.variantName}</Text>
                </View>
                <Text style={styles.itemTotal}>
                  {"\u20B9"}{(item.price * item.quantity).toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Fulfillment Type Selector */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>How do you want your order?</Text>
          </View>
          <View style={styles.fulfillmentRow}>
            {/* Home Delivery Card */}
            <TouchableOpacity
              style={[
                styles.fulfillmentCard,
                fulfillmentType === "DELIVERY" && styles.fulfillmentCardActive,
                deliveryDisabled && styles.fulfillmentCardDisabled,
              ]}
              onPress={() => !deliveryDisabled && setFulfillmentType("DELIVERY")}
              activeOpacity={deliveryDisabled ? 1 : 0.7}
            >
              <View style={[
                styles.fulfillmentIconWrap,
                fulfillmentType === "DELIVERY" && styles.fulfillmentIconWrapActive,
                deliveryDisabled && styles.fulfillmentIconWrapDisabled,
              ]}>
                <Ionicons
                  name="bicycle-outline"
                  size={22}
                  color={deliveryDisabled ? "#94a3b8" : fulfillmentType === "DELIVERY" ? colors.primary : "#64748b"}
                />
              </View>
              <Text style={[
                styles.fulfillmentTitle,
                fulfillmentType === "DELIVERY" && styles.fulfillmentTitleActive,
                deliveryDisabled && styles.fulfillmentTitleDisabled,
              ]}>
                Home Delivery
              </Text>
              {deliveryDisabled ? (
                <Text style={styles.fulfillmentUnavailable}>Not available</Text>
              ) : (
                <View style={styles.fulfillmentMeta}>
                  {deliveryEtaPreview && (
                    <Text style={styles.fulfillmentMetaText}>{deliveryEtaPreview}</Text>
                  )}
                  <Text style={[
                    styles.fulfillmentMetaText,
                    deliveryFeePreview === "FREE" && { color: colors.primary, fontWeight: "700" },
                  ]}>
                    {deliveryFeePreview}
                  </Text>
                </View>
              )}
              {fulfillmentType === "DELIVERY" && !deliveryDisabled && (
                <View style={styles.fulfillmentCheck}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>

            {/* Store Pickup Card */}
            <TouchableOpacity
              style={[
                styles.fulfillmentCard,
                fulfillmentType === "PICKUP" && styles.fulfillmentCardActive,
              ]}
              onPress={() => setFulfillmentType("PICKUP")}
              activeOpacity={0.7}
            >
              <View style={[
                styles.fulfillmentIconWrap,
                fulfillmentType === "PICKUP" && styles.fulfillmentIconWrapActive,
              ]}>
                <Ionicons
                  name="storefront-outline"
                  size={22}
                  color={fulfillmentType === "PICKUP" ? colors.primary : "#64748b"}
                />
              </View>
              <Text style={[
                styles.fulfillmentTitle,
                fulfillmentType === "PICKUP" && styles.fulfillmentTitleActive,
              ]}>
                Store Pickup
              </Text>
              <View style={styles.fulfillmentMeta}>
                <Text style={styles.fulfillmentMetaText}>~30 min</Text>
                <Text style={[styles.fulfillmentMetaText, { color: colors.primary, fontWeight: "700" }]}>
                  FREE
                </Text>
              </View>
              {fulfillmentType === "PICKUP" && (
                <View style={styles.fulfillmentCheck}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Not serviceable info banner */}
          {isNotServiceable && (
            <View style={styles.notServiceableBanner}>
              <Ionicons name="information-circle" size={16} color="#b45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.notServiceableBannerText}>
                  Delivery isn't available for your location
                  {deliveryLookup?.distance ? ` (${deliveryLookup.distance.toFixed(1)} km away)` : ""}
                  . You can pick up from the store or try a different address.
                </Text>
                <View style={styles.notServiceableActions}>
                  {addresses.length > 1 && (
                    <TouchableOpacity
                      style={styles.notServiceableBtn}
                      onPress={() => setShowAddressPicker(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="swap-horizontal-outline" size={14} color="#92400e" />
                      <Text style={styles.notServiceableBtnText}>Switch address</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.notServiceableBtn}
                    onPress={() => setShowProfileGate(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle-outline" size={14} color="#92400e" />
                    <Text style={styles.notServiceableBtnText}>Add new address</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Delivery Address — only for DELIVERY */}
        {!isPickup && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>Delivery Address</Text>
            </View>

            {loadingAddresses ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : addresses.length === 0 ? (
              <TouchableOpacity
                style={styles.addAddressPrompt}
                onPress={() => setShowProfileGate(true)}
                activeOpacity={0.7}
              >
                <View style={styles.addAddressIconWrap}>
                  <Ionicons name="location-outline" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addAddressTitle}>No saved addresses</Text>
                  <Text style={styles.addAddressSubtitle}>Tap to add your delivery address</Text>
                </View>
                <Ionicons name="add-circle" size={24} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.addressSection}>
                {addresses.map((addr) => {
                  const lookup = addressLookups[addr.id];
                  const hasLookup = !!lookup;
                  const serviceable = lookup?.serviceable;
                  return (
                    <TouchableOpacity
                      key={addr.id}
                      style={[
                        styles.addressOption,
                        selectedAddressId === addr.id && styles.addressOptionActive,
                      ]}
                      onPress={() => setSelectedAddressId(addr.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={
                          selectedAddressId === addr.id
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={20}
                        color={
                          selectedAddressId === addr.id
                            ? colors.primary
                            : "#94a3b8"
                        }
                      />
                      <View style={styles.addressOptionInfo}>
                        <View style={styles.addressOptionLabelRow}>
                          <Text style={styles.addressOptionLabel}>{addr.placeName || addr.label}</Text>
                          {addr.isDefault && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>Default</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.addressOptionText} numberOfLines={2}>
                          {addr.address}
                        </Text>
                        {hasLookup && (
                          <View style={styles.addressDeliveryInfo}>
                            {lookup.distance != null && (
                              <View style={styles.addressDeliveryTag}>
                                <Ionicons name="navigate-outline" size={11} color="#64748b" />
                                <Text style={styles.addressDeliveryTagText}>
                                  {lookup.distance.toFixed(1)} km
                                </Text>
                              </View>
                            )}
                            {serviceable ? (
                              <View style={[styles.addressDeliveryTag, styles.addressDeliveryTagGreen]}>
                                <Ionicons name="bicycle-outline" size={11} color="#16a34a" />
                                <Text style={[styles.addressDeliveryTagText, { color: "#16a34a" }]}>
                                  {lookup.deliveryFee ? `₹${lookup.deliveryFee.toFixed(0)}` : "FREE"}
                                </Text>
                              </View>
                            ) : (
                              <View style={[styles.addressDeliveryTag, styles.addressDeliveryTagRed]}>
                                <Ionicons name="close-circle-outline" size={11} color="#dc2626" />
                                <Text style={[styles.addressDeliveryTagText, { color: "#dc2626" }]}>
                                  Not serviceable
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                        {!hasLookup && addr.latitude != null && lookingUpDelivery && (
                          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 6, alignSelf: "flex-start" }} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Add new address */}
                <TouchableOpacity
                  style={styles.addNewAddressBtn}
                  onPress={() => setShowProfileGate(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.addNewAddressText}>Deliver to a different address</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Pickup Location — only for PICKUP */}
        {isPickup && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>Pickup Location</Text>
            </View>
            <View style={styles.pickupLocationCard}>
              <View style={styles.pickupLocationIcon}>
                <Ionicons name="storefront" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickupStoreName}>
                  {deliveryLookup?.storeName ?? storeName}
                </Text>
                {deliveryLookup?.storeAddress && (
                  <Text style={styles.pickupStoreAddress}>{deliveryLookup.storeAddress}</Text>
                )}
                <View style={styles.pickupReadyRow}>
                  <Ionicons name="time-outline" size={13} color={colors.primary} />
                  <Text style={styles.pickupReadyText}>Ready in ~30 min after confirmation</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Delivery Schedule */}
        {(hasSlots || (expressConfig && !expressConfig.enabled)) && !isPickup && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>Delivery Schedule</Text>
            </View>

            {/* Express disabled + no slots: show unavailable banner */}
            {expressConfig && !expressConfig.enabled && !hasSlots ? (
              <View style={styles.expressUnavailableBanner}>
                <Ionicons name="flash-off-outline" size={18} color="#b45309" />
                <Text style={styles.expressUnavailableText}>
                  Express delivery is currently unavailable for this store
                </Text>
              </View>
            ) : expressConfig && expressConfig.enabled && !expressConfig.available && !hasSlots ? (
              <View style={styles.expressUnavailableBanner}>
                <Ionicons name="time-outline" size={18} color="#b45309" />
                <Text style={styles.expressUnavailableText}>
                  Express delivery available from {expressConfig.reason?.replace("Outside operating hours ", "") ?? "later"}
                </Text>
              </View>
            ) : (
            <View style={styles.scheduleToggleRow}>
              {/* Express toggle — only show if enabled */}
              {expressConfig?.enabled !== false && (
              <TouchableOpacity
                style={[
                  styles.scheduleToggle,
                  deliveryMode === "express" && styles.scheduleToggleActive,
                  expressConfig && !expressConfig.available && styles.scheduleToggleDisabled,
                ]}
                onPress={() => {
                  if (expressConfig && !expressConfig.available) return;
                  setDeliveryMode("express");
                }}
                activeOpacity={expressConfig && !expressConfig.available ? 1 : 0.7}
              >
                <Ionicons
                  name="flash"
                  size={16}
                  color={
                    expressConfig && !expressConfig.available
                      ? "#94a3b8"
                      : deliveryMode === "express"
                        ? colors.primary
                        : "#94a3b8"
                  }
                />
                <Text style={[
                  styles.scheduleToggleText,
                  deliveryMode === "express" && styles.scheduleToggleTextActive,
                  expressConfig && !expressConfig.available && { color: "#94a3b8" },
                ]}>
                  Express
                </Text>
                {expressConfig && !expressConfig.available ? (
                  <Text style={styles.scheduleToggleSub}>Unavailable</Text>
                ) : (
                  <Text style={styles.scheduleToggleSub}>
                    {expressConfig?.etaMinutes ? `~${expressConfig.etaMinutes} min` : "ASAP"}
                  </Text>
                )}
              </TouchableOpacity>
              )}
              {/* Scheduled toggle — only show if has slots */}
              {hasSlots && (
              <TouchableOpacity
                style={[styles.scheduleToggle, deliveryMode === "scheduled" && styles.scheduleToggleActive]}
                onPress={() => setDeliveryMode("scheduled")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar"
                  size={16}
                  color={deliveryMode === "scheduled" ? colors.primary : "#94a3b8"}
                />
                <Text style={[styles.scheduleToggleText, deliveryMode === "scheduled" && styles.scheduleToggleTextActive]}>
                  Scheduled
                </Text>
                <Text style={styles.scheduleToggleSub}>Pick a time</Text>
              </TouchableOpacity>
              )}
            </View>
            )}

            {/* Express outside operating hours reason */}
            {expressConfig?.enabled && !expressConfig.available && expressConfig.reason && hasSlots && deliveryMode === "express" && (
              <View style={styles.expressReasonBanner}>
                <Ionicons name="time-outline" size={14} color="#b45309" />
                <Text style={styles.expressReasonText}>{expressConfig.reason}</Text>
              </View>
            )}

            {deliveryMode === "scheduled" && (
              <View style={styles.schedulePicker}>
                {/* Date chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.dateChipsScroll}
                  contentContainerStyle={styles.dateChipsContent}
                >
                  {Array.from({ length: 8 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() + i);
                    const dateStr = toLocalDateStr(d);
                    const isSelected = selectedDate === dateStr;
                    const dayName = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short" });
                    const dayNum = d.getDate();
                    const monthName = d.toLocaleDateString(undefined, { month: "short" });
                    return (
                      <TouchableOpacity
                        key={dateStr}
                        style={[styles.dateChip, isSelected && styles.dateChipActive]}
                        onPress={() => setSelectedDate(dateStr)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dateChipDay, isSelected && styles.dateChipDayActive]}>
                          {dayName}
                        </Text>
                        <Text style={[styles.dateChipNum, isSelected && styles.dateChipNumActive]}>
                          {dayNum}
                        </Text>
                        <Text style={[styles.dateChipMonth, isSelected && styles.dateChipMonthActive]}>
                          {monthName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Time slots */}
                {loadingSlots ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
                ) : availableSlots.length === 0 ? (
                  <View style={styles.noSlotsCard}>
                    <Ionicons name="calendar-outline" size={20} color="#94a3b8" />
                    <Text style={styles.noSlotsText}>No time slots available for this date</Text>
                  </View>
                ) : (
                  <View style={styles.slotGrid}>
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlot?.id === slot.id;
                      const formatTime = (t: string) => {
                        const [h, m] = t.split(":").map(Number);
                        const ampm = h >= 12 ? "PM" : "AM";
                        const h12 = h % 12 || 12;
                        return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
                      };
                      return (
                        <TouchableOpacity
                          key={slot.id}
                          style={[
                            styles.slotCard,
                            isSelected && styles.slotCardActive,
                            slot.full && styles.slotCardFull,
                          ]}
                          onPress={() => !slot.full && setSelectedSlot(slot)}
                          disabled={slot.full}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.slotTime, isSelected && styles.slotTimeActive, slot.full && styles.slotTimeFull]}>
                            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                          </Text>
                          {slot.full ? (
                            <Text style={styles.slotFullText}>Full</Text>
                          ) : (
                            <Text style={[styles.slotAvailable, isSelected && styles.slotAvailableActive]}>
                              {slot.available} slot{slot.available !== 1 ? "s" : ""} left
                            </Text>
                          )}
                          {isSelected && (
                            <View style={styles.slotCheck}>
                              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Coupon */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>Promo Code</Text>
          </View>
          {couponResult ? (
            <View style={styles.couponApplied}>
              <View style={{ flex: 1 }}>
                <Text style={styles.couponAppliedCode}>{couponResult.code}</Text>
                <Text style={styles.couponAppliedSaving}>You save {"\u20B9"}{couponDiscount.toFixed(0)}</Text>
              </View>
              <TouchableOpacity onPress={handleRemoveCoupon}>
                <Ionicons name="close-circle" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.couponRow}>
              <TextInput
                style={styles.couponInput}
                value={couponCode}
                onChangeText={(t) => { setCouponCode(t); setCouponError(""); }}
                placeholder="Enter promo code"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.couponApplyBtn, applyingCoupon && { opacity: 0.6 }]}
                onPress={handleApplyCoupon}
                disabled={applyingCoupon}
              >
                {applyingCoupon ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.couponApplyText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>{isPickup ? "Pickup Notes" : "Delivery Notes"}</Text>
          </View>
          <TextInput
            style={styles.deliveryNotesInput}
            value={deliveryNotes}
            onChangeText={setDeliveryNotes}
            placeholder="Any special instructions? (optional)"
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={2}
            maxLength={500}
          />
        </View>

        {/* Wallet */}
        {walletBalance > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="wallet-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>Martly Wallet</Text>
            </View>
            <View style={styles.walletCard}>
              <View style={styles.walletLeft}>
                <View style={styles.walletIconWrap}>
                  <Ionicons name="wallet" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walletBalanceLabel}>
                    Available: <Text style={styles.walletBalanceAmount}>{"\u20B9"}{walletBalance.toFixed(0)}</Text>
                  </Text>
                  {useWallet && walletDeduction > 0 && (
                    walletCoversAll ? (
                      <Text style={styles.walletApplyText}>
                        Wallet covers the full amount
                      </Text>
                    ) : (
                      <View style={styles.walletSplitInfo}>
                        <Text style={styles.walletApplyText}>
                          -{"\u20B9"}{walletDeduction.toFixed(0)} from wallet
                        </Text>
                        <Text style={styles.walletRemainderText}>
                          {"\u20B9"}{amountToPay.toFixed(0)} via {paymentMethod === "COD" ? (isPickup ? "Pay at Store" : "Cash on Delivery") : "Online Payment"}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              </View>
              <Switch
                value={useWallet}
                onValueChange={setUseWallet}
                trackColor={{ false: "#e2e8f0", true: colors.primary + "50" }}
                thumbColor={useWallet ? colors.primary : "#94a3b8"}
              />
            </View>
          </View>
        )}

        {/* Loyalty Points */}
        {loyaltyEnabled && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>Loyalty Points</Text>
            </View>
            <View style={styles.walletCard}>
              <View style={styles.walletLeft}>
                <View style={[styles.walletIconWrap, { backgroundColor: "#fffbeb" }]}>
                  <Ionicons name="star" size={20} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walletBalanceLabel}>
                    Available: <Text style={[styles.walletBalanceAmount, { color: "#d97706" }]}>{loyaltyBalance} pts</Text>
                  </Text>
                  {useLoyalty && loyaltyDeduction > 0 && (
                    <Text style={styles.walletApplyText}>
                      -{"\u20B9"}{loyaltyDeduction.toFixed(0)} ({loyaltyDeduction} pts)
                    </Text>
                  )}
                </View>
              </View>
              <Switch
                value={useLoyalty}
                onValueChange={setUseLoyalty}
                trackColor={{ false: "#e2e8f0", true: "#d97706" + "50" }}
                thumbColor={useLoyalty ? "#d97706" : "#94a3b8"}
              />
            </View>
          </View>
        )}

        {/* Payment Method — hidden when wallet covers full amount */}
        {!walletCoversAll && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="card-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>Payment Method</Text>
          </View>
          <View style={styles.paymentOptions}>
            <TouchableOpacity
              style={[styles.paymentCard, paymentMethod === "ONLINE" && styles.paymentCardActive]}
              onPress={() => setPaymentMethod("ONLINE")}
              activeOpacity={0.7}
            >
              <Ionicons
                name={paymentMethod === "ONLINE" ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={paymentMethod === "ONLINE" ? colors.primary : "#94a3b8"}
              />
              <View style={styles.paymentCardInfo}>
                <Ionicons name="card-outline" size={20} color={paymentMethod === "ONLINE" ? colors.primary : "#64748b"} />
                <View>
                  <Text style={[styles.paymentCardTitle, paymentMethod === "ONLINE" && { color: colors.primary }]}>
                    Pay Online
                  </Text>
                  <Text style={styles.paymentCardSub}>UPI, Cards, Net Banking</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentCard, paymentMethod === "COD" && styles.paymentCardActive]}
              onPress={() => setPaymentMethod("COD")}
              activeOpacity={0.7}
            >
              <Ionicons
                name={paymentMethod === "COD" ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={paymentMethod === "COD" ? colors.primary : "#94a3b8"}
              />
              <View style={styles.paymentCardInfo}>
                <Ionicons name="cash-outline" size={20} color={paymentMethod === "COD" ? colors.primary : "#64748b"} />
                <View>
                  <Text style={[styles.paymentCardTitle, paymentMethod === "COD" && { color: colors.primary }]}>
                    {isPickup ? "Pay at Store" : "Cash on Delivery"}
                  </Text>
                  <Text style={styles.paymentCardSub}>
                    {isPickup ? "Pay when you pick up" : "Pay when you receive"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Bill Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>Bill Details</Text>
          </View>
          <View style={styles.billCard}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item total</Text>
              <Text style={styles.billValue}>{"\u20B9"}{totalAmount.toFixed(0)}</Text>
            </View>
            {couponDiscount > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Coupon discount</Text>
                <Text style={styles.billSaving}>-{"\u20B9"}{couponDiscount.toFixed(0)}</Text>
              </View>
            )}
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>
                {isPickup ? "Store pickup" : "Delivery fee"}
              </Text>
              {isPickup ? (
                <Text style={styles.billFree}>FREE</Text>
              ) : lookingUpDelivery ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : freeDeliveryApplied ? (
                <View style={{ alignItems: "flex-end" }}>
                  {rawDeliveryFee > 0 && (
                    <Text style={styles.billStrikethrough}>{"\u20B9"}{rawDeliveryFee.toFixed(0)}</Text>
                  )}
                  <Text style={styles.billFree}>FREE</Text>
                </View>
              ) : deliveryFee > 0 ? (
                <Text style={styles.billValue}>{"\u20B9"}{deliveryFee.toFixed(0)}</Text>
              ) : (
                <Text style={styles.billValue}>{"\u20B9"}0</Text>
              )}
            </View>
            {walletDeduction > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Wallet</Text>
                <Text style={styles.billSaving}>-{"\u20B9"}{walletDeduction.toFixed(0)}</Text>
              </View>
            )}
            {loyaltyDeduction > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Loyalty points ({loyaltyDeduction} pts)</Text>
                <Text style={styles.billSaving}>-{"\u20B9"}{loyaltyDeduction.toFixed(0)}</Text>
              </View>
            )}
            {!isPickup && deliveryLookup?.serviceable && deliveryLookup.distance != null && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Distance</Text>
                <Text style={styles.billValue}>{deliveryLookup.distance.toFixed(1)} km</Text>
              </View>
            )}
            {deliveryMode === "scheduled" && selectedSlot && selectedDate ? (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Scheduled</Text>
                <Text style={styles.billValue}>
                  {(() => {
                    const d = new Date(selectedDate + "T00:00:00");
                    const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                    const formatTime = (t: string) => {
                      const [h, m] = t.split(":").map(Number);
                      const ampm = h >= 12 ? "PM" : "AM";
                      const h12 = h % 12 || 12;
                      return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
                    };
                    return `${dateStr}, ${formatTime(selectedSlot.startTime)} – ${formatTime(selectedSlot.endTime)}`;
                  })()}
                </Text>
              </View>
            ) : effectiveEstMinutes != null ? (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>
                  {isPickup ? "Est. ready in" : "Est. delivery"}
                </Text>
                <Text style={styles.billValue}>{effectiveEstMinutes} min</Text>
              </View>
            ) : null}
            <View style={styles.billDivider} />
            <View style={styles.billRow}>
              <Text style={styles.billGrandLabel}>To Pay</Text>
              <Text style={styles.billGrandValue}>{"\u20B9"}{amountToPay.toFixed(0)}</Text>
            </View>
            {loyaltyEarnPreview > 0 && (
              <>
                <View style={styles.billDivider} />
                <View style={styles.billRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="star" size={14} color="#d97706" />
                    <Text style={[styles.billLabel, { color: "#d97706" }]}>
                      You'll earn {loyaltyEarnPreview} points
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Place Order Bar */}
      <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom + 8) }]}>
        <TouchableOpacity
          style={[styles.placeOrderBar, orderDisabled && styles.placeOrderBarDisabled]}
          activeOpacity={0.9}
          onPress={handlePlaceOrder}
          disabled={orderDisabled}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <View style={styles.placeOrderLeft}>
                <Text style={styles.placeOrderTotal}>{"\u20B9"}{amountToPay.toFixed(0)}</Text>
                {walletCoversAll ? (
                  <View style={styles.placeOrderWalletHint}>
                    <Ionicons name="wallet" size={11} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.placeOrderWalletHintText}>via wallet</Text>
                  </View>
                ) : walletDeduction > 0 ? (
                  <View style={styles.placeOrderWalletHint}>
                    <Ionicons name="wallet" size={11} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.placeOrderWalletHintText}>+{"\u20B9"}{walletDeduction.toFixed(0)} wallet</Text>
                  </View>
                ) : (
                  <Text style={styles.placeOrderSubtext}>TOTAL</Text>
                )}
              </View>
              <View style={styles.placeOrderRight}>
                <Text style={styles.placeOrderBtnText}>
                  {walletCoversAll
                    ? "Place Order"
                    : paymentMethod === "COD"
                      ? (isPickup ? "Place Pickup Order" : "Place Order")
                      : "Pay & Order"}
                </Text>
                <Ionicons
                  name={walletCoversAll ? "wallet" : isPickup ? "storefront" : paymentMethod === "COD" ? "checkmark-circle" : "card"}
                  size={20}
                  color="#fff"
                />
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>
      <ProfileGate
        visible={showProfileGate}
        onComplete={() => {
          setShowProfileGate(false);
          fetchAddresses(true);
          // Switch back to delivery so lookup re-runs with new address
          setFulfillmentType("DELIVERY");
        }}
        onDismiss={() => setShowProfileGate(false)}
      />

      {/* Address picker modal — shown when switching address from not-serviceable banner */}
      <Modal visible={showAddressPicker} animationType="slide" transparent onRequestClose={() => setShowAddressPicker(false)}>
        <TouchableOpacity style={styles.addressPickerOverlay} activeOpacity={1} onPress={() => setShowAddressPicker(false)}>
          <View style={styles.addressPickerSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.addressPickerHandle} />
            <Text style={styles.addressPickerTitle}>Select delivery address</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {addresses.map((addr) => {
                const lookup = addressLookups[addr.id];
                return (
                  <TouchableOpacity
                    key={addr.id}
                    style={[
                      styles.addressPickerOption,
                      selectedAddressId === addr.id && styles.addressPickerOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedAddressId(addr.id);
                      setFulfillmentType("DELIVERY");
                      setShowAddressPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={selectedAddressId === addr.id ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={selectedAddressId === addr.id ? colors.primary : "#94a3b8"}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.addressPickerLabel}>{addr.placeName || addr.label}</Text>
                        {addr.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.addressPickerText} numberOfLines={2}>{addr.address}</Text>
                      {lookup && (
                        <View style={styles.addressDeliveryInfo}>
                          {lookup.distance != null && (
                            <View style={styles.addressDeliveryTag}>
                              <Ionicons name="navigate-outline" size={11} color="#64748b" />
                              <Text style={styles.addressDeliveryTagText}>{lookup.distance.toFixed(1)} km</Text>
                            </View>
                          )}
                          <View style={[
                            styles.addressDeliveryTag,
                            lookup.serviceable ? styles.addressDeliveryTagGreen : styles.addressDeliveryTagRed,
                          ]}>
                            <Ionicons
                              name={lookup.serviceable ? "bicycle-outline" : "close-circle-outline"}
                              size={11}
                              color={lookup.serviceable ? "#16a34a" : "#dc2626"}
                            />
                            <Text style={[
                              styles.addressDeliveryTagText,
                              { color: lookup.serviceable ? "#16a34a" : "#dc2626" },
                            ]}>
                              {lookup.serviceable
                                ? (lookup.deliveryFee ? `₹${lookup.deliveryFee.toFixed(0)}` : "FREE")
                                : "Not serviceable"}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.addressPickerAddBtn}
              onPress={() => { setShowAddressPicker(false); setShowProfileGate(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addressPickerAddText}>Add new address</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {razorpayData && (
        <RazorpayCheckout
          visible={razorpayVisible}
          keyId={razorpayData.key_id}
          orderId={razorpayData.razorpay_order_id}
          amount={razorpayData.amount}
          currency={razorpayData.currency}
          customerId={razorpayData.customer_id}
          prefill={{ email: user?.email, name: user?.name, contact: user?.phone ?? undefined }}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.md },
  // Store card
  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  storeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + "14",
    justifyContent: "center",
    alignItems: "center",
  },
  storeInfo: { marginLeft: 12 },
  storeName: { fontSize: 16, fontWeight: "700", color: colors.text },
  storeItemCount: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  // Min order warning
  minOrderWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: "#fff7ed",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: 12,
  },
  minOrderWarningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#c2410c",
    lineHeight: 18,
  },
  // Sections
  section: { marginTop: spacing.md, paddingHorizontal: spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Items
  itemsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  itemRow: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemQtyBadge: {
    backgroundColor: colors.primary + "14",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: "center",
  },
  itemQtyText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  itemInfo: { flex: 1, marginLeft: 12, marginRight: 12 },
  itemName: { fontSize: 14, fontWeight: "600", color: colors.text },
  itemVariant: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  itemTotal: { fontSize: 14, fontWeight: "700", color: colors.text },

  // Fulfillment selector
  fulfillmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  fulfillmentCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    alignItems: "center",
    position: "relative",
  },
  fulfillmentCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "08",
  },
  fulfillmentCardDisabled: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    opacity: 0.7,
  },
  fulfillmentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  fulfillmentIconWrapActive: {
    backgroundColor: colors.primary + "14",
  },
  fulfillmentIconWrapDisabled: {
    backgroundColor: "#f1f5f9",
  },
  fulfillmentTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
    textAlign: "center",
  },
  fulfillmentTitleActive: {
    color: colors.primary,
  },
  fulfillmentTitleDisabled: {
    color: "#94a3b8",
  },
  fulfillmentMeta: {
    alignItems: "center",
    gap: 1,
  },
  fulfillmentMetaText: {
    fontSize: 11,
    color: "#64748b",
  },
  fulfillmentUnavailable: {
    fontSize: 11,
    color: "#dc2626",
    fontWeight: "600",
    textAlign: "center",
  },
  fulfillmentCheck: {
    position: "absolute",
    top: 8,
    right: 8,
  },

  // Not serviceable banner
  notServiceableBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 12,
  },
  notServiceableBannerText: {
    fontSize: 12,
    color: "#92400e",
    lineHeight: 17,
  },
  notServiceableActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  notServiceableBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  notServiceableBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
  },

  // Pickup location card
  pickupLocationCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + "30",
    padding: 14,
    gap: 12,
    alignItems: "flex-start",
  },
  pickupLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + "14",
    justifyContent: "center",
    alignItems: "center",
  },
  pickupStoreName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  pickupStoreAddress: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
    lineHeight: 18,
  },
  pickupReadyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  pickupReadyText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
  },

  // Address section
  addAddressPrompt: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary + "08",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + "20",
    borderStyle: "dashed",
    padding: 16,
    gap: 12,
  },
  addAddressIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary + "14",
    justifyContent: "center",
    alignItems: "center",
  },
  addAddressTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  addAddressSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  addressSection: { gap: 8 },
  addressOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  addressOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary + "06" },
  addressOptionInfo: { flex: 1 },
  addressOptionLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  addressOptionLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  defaultBadge: { backgroundColor: colors.primary + "15", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  defaultBadgeText: { fontSize: 10, fontWeight: "600", color: colors.primary },
  addressOptionText: { fontSize: 13, color: "#64748b", marginTop: 2, lineHeight: 18 },
  addressDeliveryInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  addressDeliveryTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  addressDeliveryTagGreen: {
    backgroundColor: "#f0fdf4",
  },
  addressDeliveryTagRed: {
    backgroundColor: "#fef2f2",
  },
  addressDeliveryTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  addNewAddressBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + "30",
    borderStyle: "dashed",
    backgroundColor: colors.primary + "06",
  },
  addNewAddressText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },

  // Wallet
  walletCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + "25",
    padding: 14,
  },
  walletLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  walletIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + "14",
    justifyContent: "center",
    alignItems: "center",
  },
  walletBalanceLabel: {
    fontSize: 14,
    color: colors.text,
  },
  walletBalanceAmount: {
    fontWeight: "700",
    color: colors.primary,
  },
  walletApplyText: {
    fontSize: 12,
    color: "#22c55e",
    fontWeight: "600",
    marginTop: 2,
  },
  walletSplitInfo: {
    gap: 1,
  },
  walletRemainderText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },

  // Payment method
  paymentOptions: { gap: 8 },
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  paymentCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + "06" },
  paymentCardInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  paymentCardTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  paymentCardSub: { fontSize: 12, color: "#94a3b8", marginTop: 1 },

  // Bill
  billCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  billLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  billValue: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  billFree: { fontSize: fontSize.md, fontWeight: "600", color: colors.primary },
  billStrikethrough: { fontSize: 12, color: "#94a3b8", textDecorationLine: "line-through" as const },
  billSaving: { fontSize: fontSize.md, fontWeight: "600", color: "#22c55e" },
  billDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  billGrandLabel: { fontSize: 16, fontWeight: "700", color: colors.text },
  billGrandValue: { fontSize: 16, fontWeight: "700", color: colors.text },

  // Footer
  footer: {
    padding: spacing.md,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  placeOrderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  placeOrderBarDisabled: { opacity: 0.7 },
  placeOrderLeft: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  placeOrderWalletHint: { flexDirection: "row", alignItems: "center", gap: 3 },
  placeOrderWalletHintText: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  placeOrderTotal: { fontSize: 20, fontWeight: "800", color: "#fff" },
  placeOrderSubtext: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  placeOrderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  placeOrderBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Delivery schedule
  scheduleToggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  scheduleToggle: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  scheduleToggleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "08",
  },
  scheduleToggleDisabled: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    opacity: 0.6,
  },
  scheduleToggleText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  scheduleToggleTextActive: {
    color: colors.primary,
  },
  scheduleToggleSub: {
    fontSize: 11,
    color: "#94a3b8",
  },
  schedulePicker: {
    marginTop: 12,
  },
  dateChipsScroll: {
    marginHorizontal: -spacing.md,
  },
  dateChipsContent: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  dateChip: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    minWidth: 64,
  },
  dateChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "10",
  },
  dateChipDay: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  dateChipDayActive: {
    color: colors.primary,
  },
  dateChipNum: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginVertical: 2,
  },
  dateChipNumActive: {
    color: colors.primary,
  },
  dateChipMonth: {
    fontSize: 11,
    color: "#94a3b8",
  },
  dateChipMonthActive: {
    color: colors.primary,
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  slotCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: "47%" as any,
    flex: 1,
    position: "relative",
  },
  slotCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "08",
  },
  slotCardFull: {
    backgroundColor: "#f8fafc",
    opacity: 0.6,
  },
  slotTime: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  slotTimeActive: {
    color: colors.primary,
  },
  slotTimeFull: {
    color: "#94a3b8",
  },
  slotAvailable: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  slotAvailableActive: {
    color: colors.primary,
  },
  slotFullText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#dc2626",
    marginTop: 2,
  },
  slotCheck: {
    position: "absolute",
    top: 6,
    right: 6,
  },
  noSlotsCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  noSlotsText: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
  },
  expressUnavailableBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 14,
  },
  expressUnavailableText: {
    flex: 1,
    fontSize: 13,
    color: "#92400e",
    lineHeight: 18,
  },
  expressReasonBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  expressReasonText: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
  },

  // Coupon
  couponRow: { flexDirection: "row", gap: 8 },
  couponInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  couponApplyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  couponApplyText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  couponApplied: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 12,
  },
  couponAppliedCode: { fontSize: 14, fontWeight: "700", color: colors.text },
  couponAppliedSaving: { fontSize: 12, color: "#22c55e", fontWeight: "600", marginTop: 2 },
  couponError: { fontSize: 12, color: colors.error, marginTop: 6 },
  deliveryNotesInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: "top",
  },

  // Address picker modal
  addressPickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  addressPickerSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    paddingTop: 12,
  },
  addressPickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 16,
  },
  addressPickerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 14,
  },
  addressPickerOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  addressPickerOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "06",
  },
  addressPickerLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  addressPickerText: { fontSize: 13, color: "#64748b", marginTop: 2, lineHeight: 18 },
  addressPickerAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + "30",
    borderStyle: "dashed",
    backgroundColor: colors.primary + "06",
  },
  addressPickerAddText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
});
