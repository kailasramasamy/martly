import { useState, useEffect, useRef, useCallback } from "react";
import { amount } from "../../lib/money";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
} from "react-native";
import { Loader } from "../../components/Loader";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useCart } from "../../lib/cart-context";
import { colors, spacing, fontSize } from "../../constants/theme";
import { withSignIn } from "../../components/SignInPrompt";
import { strings } from "../../lib/i18n";
import { useStrings } from "../../lib/i18n/use-strings";
import { formatTime } from "../../lib/i18n/format";

interface OrderData {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentType?: "DELIVERY" | "PICKUP";
  totalAmount: string;
  walletAmountUsed?: string | null;
  estimatedDeliveryAt?: string | null;
  deliveryFee?: string | null;
  couponDiscount?: string | null;
}

function OrderSuccessScreen() {
  const { id, walletPaid, paymentMethod: paramPaymentMethod, fulfillmentType: paramFulfillmentType } =
    useLocalSearchParams<{
      id: string;
      walletPaid?: string;
      paymentMethod?: string;
      fulfillmentType?: string;
    }>();
  const router = useRouter();
  const t = useStrings("checkout");
  const { clearCart, setPendingCoupon } = useCart();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;

  // Clear cart on first focus (not useEffect to avoid double-clear in dev)
  const cartCleared = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!cartCleared.current) {
        clearCart();
        setPendingCoupon(null);
        cartCleared.current = true;
      }
    }, [clearCart, setPendingCoupon]),
  );

  // Fetch order details
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await api.get<OrderData>(`/api/v1/orders/${id}`);
        setOrder(res.data);
      } catch {
        // Silently fail — we still show the success state with params
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Run animations once loading finishes
  useEffect(() => {
    if (loading) return;

    // 1. Checkmark circle scales in with a spring
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start(() => {
      // 2. Subtle continuous pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    // 3. Content fades in and slides up
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [loading, scaleAnim, pulseAnim, contentOpacity, contentTranslateY]);

  // Determine subtitle based on payment context
  const getSubtitle = (): string => {
    if (walletPaid === "true") {
      return t.success.paidWallet;
    }
    if (paramPaymentMethod === "COD" && paramFulfillmentType === "PICKUP") {
      return t.success.payOnPickup;
    }
    if (paramPaymentMethod === "COD") {
      return t.success.payOnDelivery;
    }
    return order?.paymentStatus === "PAID" ? t.success.paidOnline : t.success.paymentPending;
  };

  const getPaymentLabel = (): string => {
    if (!order) return "";
    if (walletPaid === "true") return t.success.martlyWallet;
    const labels: Record<string, string> = { ONLINE: t.payment.online, COD: t.payment.cod };
    return labels[order.paymentMethod] ?? order.paymentMethod;
  };

  const formatEstimatedTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin > 0 && diffMin < 120) {
      return t.approxMin(diffMin);
    }
    return formatTime(date, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <Loader size="large" />
      </View>
    );
  }

  const walletUsed = order?.walletAmountUsed ? Number(order.walletAmountUsed) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Animated checkmark */}
      <Animated.View
        style={[
          styles.checkCircle,
          {
            transform: [
              { scale: Animated.multiply(scaleAnim, pulseAnim) },
            ],
          },
        ]}
      >
        <Ionicons name="checkmark" size={48} color="#fff" />
      </Animated.View>

      {/* Content (fades in after checkmark) */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }],
          },
        ]}
      >
        {/* Heading */}
        <Text style={styles.heading}>{t.success.confirmed}</Text>
        <Text style={styles.subtitle}>{getSubtitle()}</Text>

        {/* Info card */}
        {order && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t.success.orderNo}</Text>
              <Text style={styles.infoValue}>{order.id.slice(0, 8).toUpperCase()}</Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t.success.amount}</Text>
              <Text style={styles.infoValueBold}>
                {"\u20B9"}
                {amount(Number(order.totalAmount))}
              </Text>
            </View>

            {walletUsed > 0 && (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t.success.walletUsed}</Text>
                  <Text style={styles.infoValueGreen}>
                    -{"\u20B9"}
                    {amount(walletUsed)}
                  </Text>
                </View>
              </>
            )}

            {order.estimatedDeliveryAt && (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t.success.estimatedTime}</Text>
                  <Text style={styles.infoValue}>
                    {formatEstimatedTime(order.estimatedDeliveryAt)}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t.success.payment}</Text>
              <Text style={styles.infoValue}>{getPaymentLabel()}</Text>
            </View>
          </View>
        )}

        {/* Track Order button */}
        <TouchableOpacity
          style={styles.trackButton}
          activeOpacity={0.85}
          onPress={() => router.replace(`/order/${id}`)}
        >
          <Ionicons name="location-outline" size={20} color="#fff" />
          <Text style={styles.trackButtonText}>{t.success.trackOrder}</Text>
        </TouchableOpacity>

        {/* Back to Home link */}
        <TouchableOpacity
          style={styles.homeLink}
          activeOpacity={0.7}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.homeLinkText}>{t.success.backHome}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  // Checkmark circle
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: spacing.lg,
  },
  // Content
  content: {
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
  },
  heading: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  // Info card
  infoCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  infoValueBold: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.text,
  },
  infoValueGreen: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.success,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  // Track button
  trackButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: spacing.md,
  },
  trackButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: "#fff",
  },
  // Home link
  homeLink: {
    paddingVertical: spacing.sm,
  },
  homeLinkText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});

export default withSignIn(OrderSuccessScreen, "receipt-outline", () => ({
  title: strings("checkout").success.signInTitle,
  message: strings("checkout").success.signInMessage,
}));
