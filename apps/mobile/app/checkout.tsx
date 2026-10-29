import { useState, useEffect, useCallback, useRef } from "react";
import { amount } from "../lib/money";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
} from "react-native";
import { Loader } from "../components/Loader";
import { useRouter } from "expo-router";
import { useToast } from "../lib/toast-context";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../lib/cart-context";
import { useStore } from "../lib/store-context";
import { useKeyboardReveal } from "../lib/use-keyboard-reveal";
import { api } from "../lib/api";
import { ReplacementRows } from "../components/order/ReplacementRows";
import { AvailableOffers } from "../components/checkout/AvailableOffers";
import { SlotGrid, isBookable, clock, type AvailableSlot } from "../components/checkout/SlotGrid";
import { colors, spacing, fontSize, fonts } from "../constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Switch } from "react-native";
import { PaymentOptions } from "../components/checkout/PaymentOptions";
import { useOrderPayment } from "../components/checkout/use-order-payment";
import { CheckoutCreditRow } from "../components/credits/CheckoutCreditRow";
import { CreditLossNote } from "../components/credits/CreditLossNote";
import { useCheckoutCredit } from "../lib/use-checkout-credit";
import { useCredits } from "../lib/credits-context";
import { UPI_APPS, useInstalledUpiApps, loadPaymentChoice, savePaymentChoice, type PaymentChoice } from "../lib/upi-apps";
import { ProfileGate } from "../components/ProfileGate";
import { ConfirmSheet } from "../components/ConfirmSheet";
import type { FulfillmentType, UserAddress, CouponValidation, DeliveryLookupResult, LoyaltyData, MembershipStatus } from "../lib/types";
import { withSignIn } from "../components/SignInPrompt";
import { strings } from "../lib/i18n";
import { useStrings } from "../lib/i18n/use-strings";
import { formatDate } from "../lib/i18n/format";
import { StoreMark } from "../components/StoreMark";
import { useLanguage } from "../lib/language-context";
import { freeUnits, lineTotal } from "@martly/shared/offers";
import { CheckoutWalkNudge } from "../components/store-walk/WalkNudge";

type PaymentMethod = "ONLINE" | "COD";
type DeliveryMode = "express" | "scheduled";

const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface WalletData {
  balance: number;
  transactions: unknown[];
}

function CheckoutScreen() {
  const router = useRouter();
  // Set when the cart is the shopper's monthly list, so the order records this month's prices on it
  const { monthlyListId } = useLocalSearchParams<{ monthlyListId?: string }>();
  const toast = useToast();
  const t = useStrings("checkout");
  const common = useStrings("common");
  const tCart = useStrings("cart");
  const { getLocalizedName } = useLanguage();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardReveal();
  const { storeId, storeName, items, totalAmount, itemCount, pendingCoupon, setPendingCoupon } = useCart();
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
  const installedUpiApps = useInstalledUpiApps();
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>({ kind: "razorpay" });
  const paymentMethod: PaymentMethod = paymentChoice.kind === "cod" ? "COD" : "ONLINE";
  const chosenUpiApp = paymentChoice.kind === "upi" ? UPI_APPS.find((a) => a.id === paymentChoice.app) : undefined;
  const [submitting, setSubmitting] = useState(false);
  // Set at once on tap (state lands a render later), so a double tap can't place the order twice
  const placingRef = useRef(false);
  // One key per checkout attempt, sent again on a retry, so an order placed by a request whose answer was lost is
  // returned instead of placed a second time
  const idempotencyKeyRef = useRef<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponValidation | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [addressLookups, setAddressLookups] = useState<Record<string, DeliveryLookupResult>>({});
  const [lookingUpDelivery, setLookingUpDelivery] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("express");
  const [hasSlots, setHasSlots] = useState(false);
  const [expressConfig, setExpressConfig] = useState<{
    enabled: boolean; available: boolean; etaMinutes: number | null; reason?: string;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [basketTotal, setBasketTotal] = useState(0);
  const [basketWarningVisible, setBasketWarningVisible] = useState(false);

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

  // Fetch wallet balance
  useEffect(() => {
    api.get<WalletData>("/api/v1/wallet")
      .then((res) => setWalletBalance(res.data.balance))
      .catch(() => {});
  }, []);

  // Fetch tomorrow's basket total for wallet warning (only if store has subscriptions)
  useEffect(() => {
    if (!storeId || !selectedStore?.subscriptionEnabled) return;
    api.get<{ total: number; hasActiveSubscriptions: boolean }>(`/api/v1/subscriptions/basket?storeId=${storeId}`)
      .then((res) => {
        if (res.data.hasActiveSubscriptions) setBasketTotal(res.data.total);
      })
      .catch(() => {});
  }, [storeId, selectedStore?.subscriptionEnabled]);

  // Fetch loyalty data
  useEffect(() => {
    if (!storeId) return;
    api.get<LoyaltyData>(`/api/v1/loyalty?storeId=${storeId}`)
      .then((res) => setLoyaltyData(res.data))
      .catch(() => {});
    api.get<MembershipStatus>(`/api/v1/memberships/status?storeId=${storeId}`)
      .then((res) => setMembershipStatus(res.data))
      .catch(() => {});
  }, [storeId]);

  // Pre-select the last method used on this phone (if its UPI app is still installed), else the account's preference
  useEffect(() => {
    if (!installedUpiApps) return;
    const stillAvailable = (c: PaymentChoice | null) =>
      c && (c.kind !== "upi" || installedUpiApps.some((a) => a.id === c.app)) ? c : null;
    const accountPref = api.get<{ preferredPaymentMethod: string | null }>("/api/v1/orders/payment-preferences")
      .then((res) => res.data.preferredPaymentMethod)
      .catch(() => null);
    Promise.all([loadPaymentChoice(), accountPref]).then(([local, pref]) => {
      const fallback: PaymentChoice = pref === "COD"
        ? { kind: "cod" }
        : installedUpiApps[0] ? { kind: "upi", app: installedUpiApps[0].id } : { kind: "razorpay" };
      setPaymentChoice(stillAvailable(local) ?? fallback);
    });
  }, [installedUpiApps]);

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
        // Auto-select the first slot that's still open and has room
        const firstAvailable = res.data.find(isBookable);
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

  const applyCoupon = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    setCouponCode(code);
    setApplyingCoupon(true);
    setCouponError("");
    setCouponResult(null);
    try {
      const res = await api.post<CouponValidation>("/api/v1/coupons/validate", {
        code,
        storeId,
        orderAmount: totalAmount,
      });
      setCouponResult(res.data);
      // Whatever is applied becomes the saved coupon, so Home's offer cards show the right one as saved
      setPendingCoupon(res.data.code);
    } catch (e: unknown) {
      setCouponError(e instanceof Error ? e.message : t.promo.invalid);
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleApplyCoupon = () => applyCoupon(couponCode);

  // A coupon saved from Home is tried once on arrival; if it fails the reason shows and it stays selectable
  const triedPending = useRef(false);
  useEffect(() => {
    if (!pendingCoupon || !storeId || triedPending.current) return;
    triedPending.current = true;
    void applyCoupon(pendingCoupon);
  }, [pendingCoupon, storeId]);

  const handleRemoveCoupon = () => {
    setPendingCoupon(null);
    setCouponResult(null);
    setCouponCode("");
    setCouponError("");
  };

  const couponDiscount = couponResult?.discount ?? 0;
  const credit = useCheckoutCredit(storeId, totalAmount - couponDiscount);
  const { refresh: refreshCredits } = useCredits();
  // The address's distance tier sets the fee; until it's looked up, the store's lowest tier. The threshold waives it.
  const deliveryFeeFrom = selectedStore?.deliveryFeeFrom ?? 0;
  const rawDeliveryFee = isPickup ? 0 : deliveryLookup?.serviceable ? (deliveryLookup.deliveryFee ?? 0) : deliveryFeeFrom;
  const memberFreeDelivery = !isPickup && membershipStatus?.isMember && membershipStatus.membership?.freeDelivery;
  const freeDeliveryApplied = !isPickup && (memberFreeDelivery || (freeDeliveryThreshold != null && totalAmount >= freeDeliveryThreshold));
  const totalSavings = couponDiscount + credit.applied + (freeDeliveryApplied ? rawDeliveryFee : 0);
  const deliveryFee = freeDeliveryApplied ? 0 : rawDeliveryFee;
  const effectiveEstMinutes = isPickup
    ? 30
    : expressConfig?.etaMinutes != null && deliveryMode === "express"
      ? expressConfig.etaMinutes
      : deliveryLookup?.serviceable
        ? deliveryLookup.estimatedMinutes
        : undefined;
  const grandTotal = totalAmount - couponDiscount - credit.applied + deliveryFee;
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
  const loyaltyMultiplier = membershipStatus?.membership?.loyaltyMultiplier ?? 1;
  const loyaltyEarnPreview = loyaltyConfig?.isEnabled && loyaltyConfig.earnRate > 0
    ? Math.floor(grandTotal / 100 * loyaltyConfig.earnRate * loyaltyMultiplier)
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

  // An unpaid order opens on its details, where the customer can finish paying before it expires
  const payment = useOrderPayment((orderId, paid) => {
    if (paid) navigateToSuccess(orderId);
    else router.replace(`/order/${orderId}`);
  });

  const proceedWithOrder = async () => {
    if (placingRef.current) return;
    placingRef.current = true;
    setSubmitting(true);
    idempotencyKeyRef.current ??= `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
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
          source: i.source,
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
      if (credit.applied > 0) orderPayload.useCredit = true;
      if (monthlyListId) orderPayload.monthlyListId = monthlyListId;
      if (deliveryNotes.trim()) orderPayload.deliveryNotes = deliveryNotes.trim();

      if (deliveryMode === "scheduled" && selectedSlot && selectedDate) {
        orderPayload.deliverySlotId = selectedSlot.id;
        orderPayload.scheduledDate = selectedDate;
      }

      const result = await api.post<{ id: string; walletFullyCovered?: boolean }>(
        "/api/v1/orders", orderPayload, { "Idempotency-Key": idempotencyKeyRef.current },
      );
      const orderId = result.data.id;
      refreshCredits();
      const fullyCoveredByWallet = result.data.walletFullyCovered === true;

      // Wallet fully covered — no further payment needed
      if (fullyCoveredByWallet) {
        navigateToSuccess(orderId, { walletPaid: "true" });
        return;
      }

      savePaymentChoice(paymentChoice);
      if (paymentMethod === "COD") {
        // Save COD preference (fire-and-forget)
        api.patch("/api/v1/orders/payment-preferences", { preferredPaymentMethod: "COD" }).catch(() => {});
        navigateToSuccess(orderId);
        return;
      }

      try {
        await payment.pay(orderId, chosenUpiApp);
      } catch {
        // Payment couldn't open; the order's details offer to pay again
        router.replace(`/order/${orderId}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.payment.placeFailed;
      toast.show(message, "error");
    } finally {
      placingRef.current = false;
      setSubmitting(false);
    }
  };

  const handlePlaceOrder = async () => {
    // For delivery, require address — show ProfileGate if none saved
    if (!isPickup && !selectedAddressId) {
      setShowProfileGate(true);
      return;
    }

    // Warn if wallet usage would leave insufficient balance for tomorrow's basket
    if (useWallet && walletDeduction > 0 && basketTotal > 0) {
      const remainingBalance = walletBalance - walletDeduction;
      if (remainingBalance < basketTotal) {
        setBasketWarningVisible(true);
        return;
      }
    }

    proceedWithOrder();
  };

  // Delivery fee preview text for fulfillment cards
  const deliveryFeePreview = lookingUpDelivery
    ? t.fulfillment.calculating
    : freeDeliveryApplied
      ? common.free
      : deliveryLookup?.serviceable
        ? deliveryLookup.deliveryFee
          ? `\u20B9${amount(deliveryLookup.deliveryFee)}`
          : common.free
        : deliveryFeeFrom
          ? t.fulfillment.feeFrom(amount(deliveryFeeFrom))
          : common.free;

  const deliveryEtaPreview = deliveryLookup?.serviceable && deliveryLookup.estimatedMinutes
    ? t.min(deliveryLookup.estimatedMinutes)
    : null;

  return (
    <View ref={keyboard.rootRef} onLayout={keyboard.onRootLayout} style={{ flex: 1 }}>
      <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboard.topOffset}
    >
      <ScrollView keyboardDismissMode="on-drag"
        ref={keyboard.scrollRef}
        onScroll={keyboard.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Store Info */}
        <View style={styles.storeCard}>
          <StoreMark storeId={storeId} size={40} fallback={(
            <View style={styles.storeIconWrap}>
              <Ionicons name="storefront" size={18} color="#fff" />
            </View>
          )} />
          <View style={styles.storeInfo}>
            <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
            <Text style={styles.storeItemCount}>{common.items(itemCount)}</Text>
          </View>
          {effectiveEstMinutes != null && (
            <View style={styles.storeEtaChip}>
              <Ionicons name={isPickup ? "time" : "flash"} size={13} color={colors.accentText} />
              <Text style={styles.storeEtaText}>{isPickup ? t.summary.readyIn(effectiveEstMinutes) : t.summary.inMin(effectiveEstMinutes)}</Text>
            </View>
          )}
        </View>

        {/* Min order warning */}
        {belowMinimum && (
          <View style={styles.minOrderWarning}>
            <Ionicons name="alert-circle" size={18} color="#c2410c" />
            <Text style={styles.minOrderWarningText}>
              {t.summary.belowMinimum(amount(minOrderAmount! - totalAmount), amount(minOrderAmount!))}
            </Text>
          </View>
        )}

        {/* Order Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t.summary.title}</Text>
          </View>
          <View style={styles.itemsCard}>
            {items.map((item, index) => (
              <View
                key={item.storeProductId}
                style={[styles.itemRow, index < items.length - 1 && styles.itemRowBorder]}
              >
                <View style={styles.itemThumb}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.itemThumbImage} resizeMode="contain" />
                  ) : (
                    <Ionicons name="cube-outline" size={18} color="#94a3b8" />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{getLocalizedName({ name: item.productName, translations: item.translations })}</Text>
                  <Text style={styles.itemVariant}>{t.summary.variantQty(item.variantName, item.quantity)}</Text>
                  {freeUnits(item.quantity, item.offer) > 0 && (
                    <Text style={styles.itemFree}>{tCart.freeUnits(freeUnits(item.quantity, item.offer))}</Text>
                  )}
                </View>
                <Text style={styles.itemTotal}>
                  {"\u20B9"}{amount(lineTotal(item.price, item.quantity, item.offer))}
                </Text>
              </View>
            ))}
            <ReplacementRows />
          </View>
        </View>

        {/* Fulfillment Type Selector */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t.fulfillment.title}</Text>
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
                {t.fulfillment.homeDelivery}
              </Text>
              {deliveryDisabled ? (
                <Text style={styles.fulfillmentUnavailable}>{t.fulfillment.notAvailable}</Text>
              ) : (
                <View style={styles.fulfillmentMeta}>
                  {deliveryEtaPreview && (
                    <Text style={styles.fulfillmentMetaText}>{deliveryEtaPreview}</Text>
                  )}
                  <Text style={[
                    styles.fulfillmentMetaText,
                    deliveryFeePreview === common.free && { color: colors.primary, fontWeight: "700" },
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
                {t.fulfillment.storePickup}
              </Text>
              <View style={styles.fulfillmentMeta}>
                <Text style={styles.fulfillmentMetaText}>{t.fulfillment.pickupEta}</Text>
                <Text style={[styles.fulfillmentMetaText, { color: colors.primary, fontWeight: "700" }]}>
                  {common.free}
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
                  {t.fulfillment.notServiceable(deliveryLookup?.distance ? deliveryLookup.distance.toFixed(1) : null)}
                </Text>
                <View style={styles.notServiceableActions}>
                  {addresses.length > 1 && (
                    <TouchableOpacity
                      style={styles.notServiceableBtn}
                      onPress={() => setShowAddressPicker(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="swap-horizontal-outline" size={14} color="#92400e" />
                      <Text style={styles.notServiceableBtnText}>{t.fulfillment.switchAddress}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.notServiceableBtn}
                    onPress={() => setShowProfileGate(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle-outline" size={14} color="#92400e" />
                    <Text style={styles.notServiceableBtnText}>{t.fulfillment.addNewAddress}</Text>
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
              <Ionicons name="location-outline" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t.address.title}</Text>
            </View>

            {loadingAddresses ? (
              <Loader style={{ marginVertical: 16 }} />
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
                  <Text style={styles.addAddressTitle}>{t.address.noneTitle}</Text>
                  <Text style={styles.addAddressSubtitle}>{t.address.noneSubtitle}</Text>
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
                              <Text style={styles.defaultBadgeText}>{t.address.default}</Text>
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
                                  {t.address.km(lookup.distance.toFixed(1))}
                                </Text>
                              </View>
                            )}
                            {serviceable ? (
                              <View style={[styles.addressDeliveryTag, styles.addressDeliveryTagGreen]}>
                                <Ionicons name="bicycle-outline" size={11} color="#16a34a" />
                                <Text style={[styles.addressDeliveryTagText, { color: "#16a34a" }]}>
                                  {lookup.deliveryFee ? `₹${amount(lookup.deliveryFee)}` : common.free}
                                </Text>
                              </View>
                            ) : (
                              <View style={[styles.addressDeliveryTag, styles.addressDeliveryTagRed]}>
                                <Ionicons name="close-circle-outline" size={11} color="#dc2626" />
                                <Text style={[styles.addressDeliveryTagText, { color: "#dc2626" }]}>
                                  {t.address.notServiceable}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                        {!hasLookup && addr.latitude != null && lookingUpDelivery && (
                          <Loader size="small" style={{ marginTop: 6, alignSelf: "flex-start" }} />
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
                  <Text style={styles.addNewAddressText}>{t.address.differentAddress}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Pickup Location — only for PICKUP */}
        {isPickup && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t.address.pickupTitle}</Text>
            </View>
            <View style={styles.pickupLocationCard}>
              <StoreMark storeId={storeId} size={40} fallback={(
                <View style={styles.pickupLocationIcon}>
                  <Ionicons name="storefront" size={20} color={colors.primary} />
                </View>
              )} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickupStoreName}>
                  {storeName}
                </Text>
                {deliveryLookup?.storeAddress && (
                  <Text style={styles.pickupStoreAddress}>{deliveryLookup.storeAddress}</Text>
                )}
                <View style={styles.pickupReadyRow}>
                  <Ionicons name="time-outline" size={13} color={colors.primary} />
                  <Text style={styles.pickupReadyText}>{t.address.pickupReady}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Delivery Schedule */}
        {(hasSlots || (expressConfig && !expressConfig.enabled)) && !isPickup && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t.schedule.title}</Text>
            </View>

            {/* Express disabled + no slots: show unavailable banner */}
            {expressConfig && !expressConfig.enabled && !hasSlots ? (
              <View style={styles.expressUnavailableBanner}>
                <Ionicons name="flash-off-outline" size={18} color="#b45309" />
                <Text style={styles.expressUnavailableText}>
                  {t.schedule.expressOff}
                </Text>
              </View>
            ) : expressConfig && expressConfig.enabled && !expressConfig.available && !hasSlots ? (
              <View style={styles.expressUnavailableBanner}>
                <Ionicons name="time-outline" size={18} color="#b45309" />
                <Text style={styles.expressUnavailableText}>
                  {t.schedule.expressFrom(expressConfig.reason?.replace("Outside operating hours ", "") ?? t.schedule.later)}
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
                  {t.schedule.express}
                </Text>
                {expressConfig && !expressConfig.available ? (
                  <Text style={styles.scheduleToggleSub}>{t.schedule.unavailable}</Text>
                ) : (
                  <Text style={styles.scheduleToggleSub}>
                    {expressConfig?.etaMinutes ? t.approxMin(expressConfig.etaMinutes) : t.schedule.asap}
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
                  {t.schedule.scheduled}
                </Text>
                <Text style={styles.scheduleToggleSub}>{t.schedule.pickTime}</Text>
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
                    const dayName = i === 0 ? common.today : i === 1 ? common.tomorrow : formatDate(d, { weekday: "short" });
                    const dayNum = d.getDate();
                    const monthName = formatDate(d, { month: "short" });
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
                <SlotGrid slots={availableSlots} loading={loadingSlots} selectedId={selectedSlot?.id ?? null} onSelect={setSelectedSlot} />
              </View>
            )}
          </View>
        )}

        {/* Coupon */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t.promo.title}</Text>
          </View>
          {couponResult ? (
            <View style={styles.couponApplied}>
              <View style={{ flex: 1 }}>
                <Text style={styles.couponAppliedCode}>{couponResult.code}</Text>
                <Text style={styles.couponAppliedSaving}>{t.promo.youSave(amount(couponDiscount))}</Text>
              </View>
              <TouchableOpacity onPress={handleRemoveCoupon}>
                <Ionicons name="close-circle" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
            <AvailableOffers storeId={storeId} orderAmount={totalAmount} disabled={applyingCoupon} onApply={applyCoupon} />
            <View style={styles.couponRow}>
              <TextInput
                style={styles.couponInput}
                value={couponCode}
                onChangeText={(text) => { setCouponCode(text); setCouponError(""); }}
                placeholder={t.promo.placeholder}
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.couponApplyBtn, applyingCoupon && { opacity: 0.6 }]}
                onPress={handleApplyCoupon}
                disabled={applyingCoupon}
              >
                {applyingCoupon ? (
                  <Loader color="#fff" size="small" />
                ) : (
                  <Text style={styles.couponApplyText}>{t.promo.apply}</Text>
                )}
              </TouchableOpacity>
            </View>
            </>
          )}
          {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>{isPickup ? t.notes.pickup : t.notes.delivery}</Text>
          </View>
          <TextInput
            style={styles.deliveryNotesInput}
            value={deliveryNotes}
            onChangeText={setDeliveryNotes}
            placeholder={t.notes.placeholder}
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
              <Ionicons name="wallet-outline" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t.wallet.title}</Text>
            </View>
            <View style={styles.walletCard}>
              <View style={styles.walletLeft}>
                <View style={styles.walletIconWrap}>
                  <Ionicons name="wallet" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walletBalanceLabel}>
                    {t.wallet.available} <Text style={styles.walletBalanceAmount}>{"\u20B9"}{amount(walletBalance)}</Text>
                  </Text>
                  {useWallet && walletDeduction > 0 && (
                    walletCoversAll ? (
                      <Text style={styles.walletApplyText}>
                        {t.wallet.coversAll}
                      </Text>
                    ) : (
                      <View style={styles.walletSplitInfo}>
                        <Text style={styles.walletApplyText}>
                          {t.wallet.fromWallet(amount(walletDeduction))}
                        </Text>
                        <Text style={styles.walletRemainderText}>
                          {t.wallet.via(amount(amountToPay), paymentMethod === "COD" ? (isPickup ? t.payment.payAtStore : t.payment.cod) : chosenUpiApp?.label ?? t.payment.online)}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              </View>
              <Switch
                value={useWallet}
                onValueChange={setUseWallet}
                trackColor={{ false: "#e2e8f0", true: colors.primary }}
                ios_backgroundColor="#e2e8f0"
                thumbColor="#fff"
              />
            </View>
            {useWallet && walletDeduction > 0 && basketTotal > 0 && (walletBalance - walletDeduction) < basketTotal && (
              <View style={styles.basketWarningBanner}>
                <Ionicons name="warning-outline" size={16} color="#b45309" />
                <Text style={styles.basketWarningText}>
                  {t.wallet.lowWarning(amount(walletBalance - walletDeduction), amount(basketTotal))}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Loyalty Points */}
        {loyaltyEnabled && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star-outline" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t.loyalty.title}</Text>
            </View>
            <View style={styles.walletCard}>
              <View style={styles.walletLeft}>
                <View style={[styles.walletIconWrap, { backgroundColor: "#fffbeb" }]}>
                  <Ionicons name="star" size={20} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walletBalanceLabel}>
                    {t.wallet.available} <Text style={[styles.walletBalanceAmount, { color: "#d97706" }]}>{t.loyalty.pts(loyaltyBalance)}</Text>
                  </Text>
                  {useLoyalty && loyaltyDeduction > 0 && (
                    <Text style={styles.walletApplyText}>
                      {t.loyalty.deduction(amount(loyaltyDeduction), loyaltyDeduction)}
                    </Text>
                  )}
                </View>
              </View>
              <Switch
                value={useLoyalty}
                onValueChange={setUseLoyalty}
                trackColor={{ false: "#e2e8f0", true: "#d97706" }}
                ios_backgroundColor="#e2e8f0"
                thumbColor="#fff"
              />
            </View>
          </View>
        )}

        {/* Payment Method — hidden when wallet covers full amount */}
        {!walletCoversAll && (
          <PaymentOptions
            choice={paymentChoice}
            onChange={setPaymentChoice}
            installedApps={installedUpiApps ?? []}
            isPickup={isPickup}
          />
        )}

        {/* Bill Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t.bill.title}</Text>
          </View>
          <View style={styles.billCard}>
            {totalSavings > 0 && (
              <View style={styles.savingsStrip}>
                <Ionicons name="pricetag" size={14} color={colors.accentText} />
                <Text style={styles.savingsText}>
                  {t.bill.saving(amount(totalSavings))}
                </Text>
              </View>
            )}
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>{t.bill.itemTotal}</Text>
              <Text style={styles.billValue}>{"\u20B9"}{amount(totalAmount)}</Text>
            </View>
            {couponDiscount > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>{t.bill.couponDiscount}</Text>
                <Text style={styles.billSaving}>-{"\u20B9"}{amount(couponDiscount)}</Text>
              </View>
            )}
            <CheckoutCreditRow credit={credit} />
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>
                {isPickup ? t.bill.storePickup : t.bill.deliveryFee}
              </Text>
              {isPickup ? (
                <Text style={styles.billFree}>{common.free}</Text>
              ) : lookingUpDelivery ? (
                <Loader size="small" />
              ) : freeDeliveryApplied ? (
                <View style={{ alignItems: "flex-end" }}>
                  {rawDeliveryFee > 0 && (
                    <Text style={styles.billStrikethrough}>{"\u20B9"}{amount(rawDeliveryFee)}</Text>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={styles.billFree}>{common.free}</Text>
                    {memberFreeDelivery && (
                      <View style={styles.plusBadge}>
                        <Text style={styles.plusBadgeText}>{t.bill.plus}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : deliveryFee > 0 ? (
                <Text style={styles.billValue}>{"\u20B9"}{amount(deliveryFee)}</Text>
              ) : (
                <Text style={styles.billValue}>{"\u20B9"}0</Text>
              )}
            </View>
            {walletDeduction > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>{t.bill.wallet}</Text>
                <Text style={styles.billSaving}>-{"\u20B9"}{amount(walletDeduction)}</Text>
              </View>
            )}
            {loyaltyDeduction > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>{t.bill.loyalty(loyaltyDeduction)}</Text>
                <Text style={styles.billSaving}>-{"\u20B9"}{amount(loyaltyDeduction)}</Text>
              </View>
            )}
            {!isPickup && deliveryLookup?.serviceable && deliveryLookup.distance != null && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>{t.bill.distance}</Text>
                <Text style={styles.billValue}>{t.address.km(deliveryLookup.distance.toFixed(1))}</Text>
              </View>
            )}
            {deliveryMode === "scheduled" && selectedSlot && selectedDate ? (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>{t.bill.scheduled}</Text>
                <Text style={styles.billValue}>
                  {t.bill.scheduledAt(
                    formatDate(selectedDate + "T00:00:00", { month: "short", day: "numeric" }),
                    clock(selectedSlot.startTime),
                    clock(selectedSlot.endTime),
                  )}
                </Text>
              </View>
            ) : effectiveEstMinutes != null ? (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>
                  {isPickup ? t.bill.estReady : t.bill.estDelivery}
                </Text>
                <Text style={styles.billValue}>{t.min(effectiveEstMinutes)}</Text>
              </View>
            ) : null}
            <View style={styles.billDivider} />
            <View style={styles.billRow}>
              <Text style={styles.billGrandLabel}>{t.bill.toPay}</Text>
              <Text style={styles.billGrandValue}>{"\u20B9"}{amount(amountToPay)}</Text>
            </View>
            {loyaltyEarnPreview > 0 && (
              <>
                <View style={styles.billDivider} />
                <View style={styles.billRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="star" size={14} color="#d97706" />
                    <Text style={[styles.billLabel, { color: "#d97706" }]}>
                      {t.bill.earn(loyaltyEarnPreview, loyaltyMultiplier)}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <CheckoutWalkNudge />
      {/* Sticky Place Order Bar */}
      <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom + 8) }]}>
        <CreditLossNote credit={credit} orderAmount={totalAmount - couponDiscount} />
        <TouchableOpacity
          style={[styles.placeOrderBar, orderDisabled && styles.placeOrderBarDisabled]}
          activeOpacity={0.9}
          onPress={handlePlaceOrder}
          disabled={orderDisabled}
        >
          {submitting ? (
            <Loader color="#fff" size="small" />
          ) : (
            <>
              <View style={styles.placeOrderLeft}>
                <Text style={styles.placeOrderTotal}>{"\u20B9"}{amount(amountToPay)}</Text>
                {walletCoversAll ? (
                  <View style={styles.placeOrderWalletHint}>
                    <Ionicons name="wallet" size={11} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.placeOrderWalletHintText}>{t.footer.viaWallet}</Text>
                  </View>
                ) : walletDeduction > 0 ? (
                  <View style={styles.placeOrderWalletHint}>
                    <Ionicons name="wallet" size={11} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.placeOrderWalletHintText}>{t.footer.plusWallet(amount(walletDeduction))}</Text>
                  </View>
                ) : (
                  <Text style={styles.placeOrderSubtext}>{t.footer.total}</Text>
                )}
              </View>
              <View style={styles.placeOrderRight}>
                <Text style={styles.placeOrderBtnText} numberOfLines={2}>
                  {walletCoversAll
                    ? t.footer.placeOrder
                    : paymentMethod === "COD"
                      ? (isPickup ? t.footer.placePickup : t.footer.placeOrder)
                      : chosenUpiApp ? t.footer.payWith(chosenUpiApp.label) : t.footer.payAndOrder}
                </Text>
                <Ionicons
                  name={walletCoversAll ? "wallet" : isPickup ? "storefront" : paymentMethod === "COD" ? "checkmark-circle" : "card"}
                  size={18}
                  color={colors.primary}
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
      <ConfirmSheet
        visible={basketWarningVisible}
        title={t.wallet.lowTitle}
        message={t.wallet.lowWarning(amount(walletBalance - walletDeduction), amount(basketTotal))}
        icon="wallet-outline"
        iconColor="#f59e0b"
        confirmLabel={t.wallet.placeAnyway}
        onConfirm={() => { setBasketWarningVisible(false); proceedWithOrder(); }}
        onCancel={() => setBasketWarningVisible(false)}
      />

      {/* Address picker modal — shown when switching address from not-serviceable banner */}
      <Modal visible={showAddressPicker} animationType="slide" transparent onRequestClose={() => setShowAddressPicker(false)}>
        <TouchableOpacity style={styles.addressPickerOverlay} activeOpacity={1} onPress={() => setShowAddressPicker(false)}>
          <View style={styles.addressPickerSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.addressPickerHandle} />
            <Text style={styles.addressPickerTitle}>{t.address.pickerTitle}</Text>
            <ScrollView keyboardDismissMode="on-drag" style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
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
                            <Text style={styles.defaultBadgeText}>{t.address.default}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.addressPickerText} numberOfLines={2}>{addr.address}</Text>
                      {lookup && (
                        <View style={styles.addressDeliveryInfo}>
                          {lookup.distance != null && (
                            <View style={styles.addressDeliveryTag}>
                              <Ionicons name="navigate-outline" size={11} color="#64748b" />
                              <Text style={styles.addressDeliveryTagText}>{t.address.km(lookup.distance.toFixed(1))}</Text>
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
                                ? (lookup.deliveryFee ? `₹${amount(lookup.deliveryFee)}` : common.free)
                                : t.address.notServiceable}
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
              <Text style={styles.addressPickerAddText}>{t.fulfillment.addNewAddress}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {payment.sheets}
    </KeyboardAvoidingView>
    </View>
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
    margin: spacing.md,
    marginBottom: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  storeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  storeInfo: { marginLeft: 12, flex: 1 },
  storeName: { fontFamily: fonts.extrabold, fontSize: 16.5, color: "#fff" },
  storeItemCount: { fontFamily: fonts.medium, fontSize: 12.5, color: "rgba(255,255,255,0.8)", marginTop: 1 },
  storeEtaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  storeEtaText: { fontFamily: fonts.extrabold, fontSize: 12, color: colors.accentText },
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
    fontFamily: fonts.extrabold,
    fontSize: 15.5,
    color: colors.text,
    letterSpacing: -0.2,
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
  itemThumb: {
    width: 48, height: 48, borderRadius: 10, backgroundColor: "#f8fafc",
    padding: 3, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  // Blends white product-photo backgrounds into the tile, as on the product cards
  itemThumbImage: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  itemInfo: { flex: 1, marginLeft: 12, marginRight: 12 },
  itemName: { fontSize: 14, fontWeight: "600", color: colors.text },
  itemVariant: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  itemFree: { fontSize: 11, fontWeight: "800", color: colors.success, marginTop: 1 },
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
  basketWarningBanner: {
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
  basketWarningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
    lineHeight: 17,
  },

  // Payment method

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
  billGrandLabel: { fontFamily: fonts.extrabold, fontSize: 16.5, color: colors.text },
  billGrandValue: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.primary },
  savingsStrip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fef3c7", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8,
  },
  savingsText: { fontFamily: fonts.bold, fontSize: 13, color: colors.accentText },
  plusBadge: { backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  plusBadgeText: { fontFamily: fonts.extrabold, fontSize: 9, color: colors.accentText },

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
  // Both sides may give way, so a longer label (Tamil runs longer) wraps instead of pushing the button off-screen
  placeOrderLeft: { flexShrink: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 6, marginRight: 10 },
  placeOrderWalletHint: { flexDirection: "row", alignItems: "center", gap: 3 },
  placeOrderWalletHintText: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  placeOrderTotal: { fontFamily: fonts.extrabold, fontSize: 21, color: "#fff" },
  placeOrderSubtext: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  placeOrderRight: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  placeOrderBtnText: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 15, color: colors.primary },

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

export default withSignIn(CheckoutScreen, "bag-check-outline", () => ({
  title: strings("checkout").signInTitle,
  message: strings("checkout").signInMessage,
}));
