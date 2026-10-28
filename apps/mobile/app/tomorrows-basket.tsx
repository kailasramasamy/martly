import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
} from "react-native";
import { Loader } from "../components/Loader";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { useBasketMode } from "../lib/basket-mode-context";
import { colors, spacing, fontSize, fonts } from "../constants/theme";
import { WalletRecharge } from "../components/account/WalletRecharge";
import type { TomorrowsBasket, BasketItem } from "../lib/types";
import { withSignIn } from "../components/SignInPrompt";
import { strings } from "../lib/i18n";
import { useStrings } from "../lib/i18n/use-strings";
import { formatDate, formatTime } from "../lib/i18n/format";
import { useLanguage } from "../lib/language-context";

function TomorrowsBasketScreen() {
  const t = useStrings("subscriptions");
  const { getLocalizedName } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedStore } = useStore();
  const { enterBasketMode, exitBasketMode } = useBasketMode();
  const storeId = selectedStore?.id;

  const [basket, setBasket] = useState<TomorrowsBasket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [cutoffPassed, setCutoffPassed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [rechargeSheetVisible, setRechargeSheetVisible] = useState(false);

  const fetchBasket = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await api.get<TomorrowsBasket>(
        `/api/v1/subscriptions/basket?storeId=${storeId}`,
      );
      setBasket(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchBasket();
  }, [fetchBasket]);

  // Exit basket mode and refresh when screen gains focus (returning from browse)
  useFocusEffect(
    useCallback(() => {
      exitBasketMode();
      fetchBasket();
    }, [exitBasketMode, fetchBasket]),
  );

  // Countdown timer
  const updateCountdown = useCallback(() => {
    if (!basket?.cutoffTime) return;

    const [hours, minutes] = basket.cutoffTime.split(":").map(Number);
    const now = new Date();
    const cutoff = new Date();
    cutoff.setHours(hours, minutes, 0, 0);

    // If cutoff is for tomorrow's delivery, it's today's cutoff
    const diff = cutoff.getTime() - now.getTime();

    const cutoffFormatted = formatTime(cutoff, { hour: "numeric", minute: "2-digit", hour12: true });

    if (diff <= 0) {
      setCutoffPassed(true);
      setCountdown(t.basket.cutoffPassed(cutoffFormatted));
    } else {
      setCutoffPassed(false);
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setCountdown(t.basket.timeLeft(h, m, cutoffFormatted));
    }
  }, [basket?.cutoffTime, t]);

  useEffect(() => {
    updateCountdown();
    timerRef.current = setInterval(updateCountdown, 60000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [updateCountdown]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBasket();
  };

  const handleQuantityChange = async (item: BasketItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      await handleRemoveAddon(item);
      return;
    }
    try {
      await api.patch(`/api/v1/subscriptions/basket/items/${item.storeProductId}`, {
        quantity: newQty,
      });
      fetchBasket();
    } catch {
      // silently fail
    }
  };

  const handleRemoveAddon = async (item: BasketItem) => {
    try {
      await api.delete(`/api/v1/subscriptions/basket/items/${item.storeProductId}`);
      fetchBasket();
    } catch {
      // silently fail
    }
  };

  const handleSubscriptionQuantityChange = async (item: BasketItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 0) return;
    try {
      await api.put("/api/v1/subscriptions/basket/override", {
        subscriptionId: item.subscriptionId,
        storeProductId: item.storeProductId,
        quantity: newQty,
      });
      fetchBasket();
    } catch {
      // silently fail
    }
  };

  const handleResetOverride = async (item: BasketItem) => {
    try {
      await api.delete(
        `/api/v1/subscriptions/basket/override/${item.subscriptionId}/${item.storeProductId}`,
      );
      fetchBasket();
    } catch {
      // silently fail
    }
  };

  const getRechargeChips = () => {
    if (!basket) return [];
    const shortfall = Math.ceil(basket.total - basket.walletBalance);
    const exact = Math.max(shortfall, 50);
    // Round up to nearest 50 for clean chip values above exact
    const round50 = (n: number) => Math.ceil(n / 50) * 50;
    const chips = [exact];
    const bump1 = round50(exact + 50);
    const bump2 = round50(exact + 150);
    const bump3 = round50(exact + 350);
    if (bump1 > exact) chips.push(bump1);
    if (bump2 > bump1) chips.push(bump2);
    if (bump3 > bump2) chips.push(bump3);
    return chips;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Loader size="large" />
      </View>
    );
  }

  if (!storeId) {
    return (
      <View style={styles.center}>
        <Ionicons name="storefront-outline" size={48} color="#94a3b8" />
        <Text style={styles.emptyTitle}>{t.basket.selectStore}</Text>
        <Text style={styles.emptySubtitle}>
          {t.basket.selectStoreHint}
        </Text>
      </View>
    );
  }

  if (!basket || !basket.hasActiveSubscriptions) {
    return (
      <View style={styles.center}>
        <Ionicons name="basket-outline" size={48} color="#94a3b8" />
        <Text style={styles.emptyTitle}>{t.basket.noActive}</Text>
        <Text style={styles.emptySubtitle}>
          {t.basket.noActiveHint}
        </Text>
      </View>
    );
  }

  const subscriptionItems = basket.items.filter((i) => i.source === "subscription");
  const addonItems = basket.items.filter((i) => i.source === "addon");

  const deliveryDate = new Date(basket.deliveryDate);
  const formattedDate = formatDate(deliveryDate, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const cutoffHour = basket.cutoffTime
    ? (() => {
        const [h, m] = basket.cutoffTime.split(":").map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return formatTime(d, { hour: "numeric", minute: "2-digit", hour12: true });
      })()
    : "";

  const deliveryWindow = (() => {
    if (!basket.deliveryWindowStart || !basket.deliveryWindowEnd) return null;
    const fmt = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return formatTime(d, { hour: "numeric", minute: "2-digit", hour12: true });
    };
    return `${fmt(basket.deliveryWindowStart)} - ${fmt(basket.deliveryWindowEnd)}`;
  })();

  const walletSufficient = basket.walletBalance >= basket.total;

  const renderItem = (item: BasketItem, isAddon: boolean) => (
    <View
      key={item.storeProductId}
      style={[styles.itemRow, !isAddon && styles.itemRowSubscription]}
    >
      {item.product.imageUrl ? (
        <Image source={{ uri: item.product.imageUrl }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
          <Ionicons name="cube-outline" size={20} color="#94a3b8" />
        </View>
      )}

      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={2}>
          {getLocalizedName(item.product)}
        </Text>
        <Text style={styles.itemVariant}>
          {item.variant.name ?? `${item.variant.unitValue} ${item.variant.unitType}`}
        </Text>

        <View style={styles.itemBottom}>
          {isAddon ? (
            <View style={styles.qtyControls}>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => handleQuantityChange(item, -1)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.quantity === 1 ? "trash-outline" : "remove"}
                  size={16}
                  color={item.quantity === 1 ? colors.error : colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => handleQuantityChange(item, 1)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.qtyControls}>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => handleSubscriptionQuantityChange(item, -1)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.quantity <= 1 ? "close" : "remove"}
                  size={16}
                  color={item.quantity <= 1 ? colors.error : colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => handleSubscriptionQuantityChange(item, 1)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.priceWrap}>
            {item.pricing.savingsAmount > 0 && (
              <Text style={styles.originalPrice}>
                {"\u20B9"}{item.pricing.originalPrice}
              </Text>
            )}
            <Text style={styles.effectivePrice}>
              {"\u20B9"}{item.pricing.effectivePrice}
            </Text>
          </View>
        </View>

        {!isAddon && item.isOverridden && (
          <View style={styles.overrideHint}>
            <Text style={styles.overrideHintText}>
              {t.basket.defaultQty(item.defaultQuantity)}
            </Text>
            <TouchableOpacity onPress={() => handleResetOverride(item)} activeOpacity={0.7}>
              <Text style={styles.overrideResetText}>{t.basket.reset}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Cutoff Countdown Bar */}
      <View style={[styles.cutoffBar, cutoffPassed && styles.cutoffBarPassed]}>
        <Ionicons
          name={cutoffPassed ? "alert-circle" : "time-outline"}
          size={18}
          color="#fff"
        />
        <Text style={styles.cutoffText}>{countdown}</Text>
      </View>

      <ScrollView keyboardDismissMode="on-drag"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Delivery Date Header */}
        <View style={styles.dateHeader}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={styles.dateText}>{t.basket.deliveryOn(formattedDate, deliveryWindow)}</Text>
          </View>
          <Text style={styles.dateSubtext}>
            {t.basket.autoOrderAt(cutoffHour)}
          </Text>
        </View>

        {/* Subscription Items */}
        {subscriptionItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="repeat-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t.basket.fromSubscriptions}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{subscriptionItems.length}</Text>
              </View>
            </View>
            {subscriptionItems.map((item) => renderItem(item, false))}
          </View>
        )}

        {/* Add-on Items */}
        {addonItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="add-circle-outline" size={18} color={colors.secondary} />
              <Text style={styles.sectionTitle}>{t.basket.addons}</Text>
              <View style={[styles.countBadge, styles.countBadgeAddon]}>
                <Text style={[styles.countBadgeText, styles.countBadgeTextAddon]}>
                  {addonItems.length}
                </Text>
              </View>
            </View>
            {addonItems.map((item) => renderItem(item, true))}
          </View>
        )}

        {/* Add Items Button */}
        <TouchableOpacity
          style={styles.addItemsButton}
          activeOpacity={0.7}
          onPress={() => {
            if (storeId) enterBasketMode(storeId);
            router.push("/(tabs)");
          }}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <View style={styles.addItemsTextWrap}>
            <Text style={styles.addItemsTitle}>
              {addonItems.length > 0 ? t.basket.addMore : t.basket.addExtra}
            </Text>
            <Text style={styles.addItemsSubtitle}>
              {t.basket.browseHint}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* Spacer for bottom summary */}
        <View style={{ height: 220 }} />
      </ScrollView>

      {/* Bottom Summary (sticky) */}
      <View style={[styles.bottomSummary, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t.basket.subtotal}</Text>
          <Text style={styles.summaryValue}>{"\u20B9"}{basket.subtotal}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t.basket.deliveryFee}</Text>
          <Text style={styles.summaryValue}>
            {basket.deliveryFee === 0 ? t.basket.free : `\u20B9${basket.deliveryFee}`}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>{t.basket.total}</Text>
          <Text style={styles.totalValue}>{"\u20B9"}{basket.total}</Text>
        </View>

        {walletSufficient ? (
          <View style={[styles.walletRow, styles.walletRowSuccess]}>
            <Ionicons name="wallet-outline" size={16} color={colors.success} />
            <Text style={[styles.walletText, styles.walletTextSuccess]}>
              {t.basket.paidFromWallet}
            </Text>
            <Text style={[styles.walletBalance, styles.walletTextSuccess]}>
              {"\u20B9"}{basket.walletBalance}
            </Text>
          </View>
        ) : (
          <View style={styles.walletInsufficientWrap}>
            <View style={[styles.walletRow, styles.walletRowError]}>
              <Ionicons name="wallet-outline" size={16} color={colors.error} />
              <Text style={[styles.walletText, styles.walletTextError]}>
                {t.basket.insufficient(basket.walletBalance)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.rechargeButton}
              activeOpacity={0.8}
              onPress={() => setRechargeSheetVisible(true)}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.rechargeButtonText}>
                {t.basket.rechargeWallet}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <WalletRecharge
        visible={rechargeSheetVisible}
        chips={getRechargeChips()}
        subtitle={t.basket.youNeed(Math.ceil(basket.total - basket.walletBalance))}
        firstIsMinimum
        onClose={() => setRechargeSheetVisible(false)}
        onRecharged={fetchBasket}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    gap: 12,
  },

  // Cutoff bar
  cutoffBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  cutoffBarPassed: {
    backgroundColor: colors.error,
  },
  cutoffText: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: "#fff",
  },

  // Date header
  dateHeader: {
    backgroundColor: "#fff",
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  dateSubtext: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: 28,
  },

  // Sections
  section: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.text,
    flex: 1,
  },
  countBadge: {
    backgroundColor: colors.primary + "15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  countBadgeAddon: {
    backgroundColor: colors.secondary + "15",
  },
  countBadgeTextAddon: {
    color: colors.secondary,
  },

  // Item row
  itemRow: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemRowSubscription: {
    backgroundColor: "#f8fafc",
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  itemImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.text,
    lineHeight: 18,
  },
  itemVariant: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },

  // Quantity controls (add-ons)
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.text,
    minWidth: 24,
    textAlign: "center",
  },

  // Override hint
  overrideHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  overrideHintText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  overrideResetText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },

  // Price
  priceWrap: {
    alignItems: "flex-end",
  },
  originalPrice: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#94a3b8",
    textDecorationLine: "line-through",
  },
  effectivePrice: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.text,
  },

  // Add items button
  addItemsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  addItemsTextWrap: {
    flex: 1,
  },
  addItemsTitle: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  addItemsSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Bottom summary
  bottomSummary: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  totalValue: {
    fontSize: fontSize.lg,
    fontFamily: fonts.bold,
    color: colors.text,
  },

  // Wallet status
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  walletRowSuccess: {
    backgroundColor: "#f0fdf4",
    marginTop: 10,
  },
  walletRowError: {
    backgroundColor: "#fef2f2",
  },
  walletText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },
  walletTextSuccess: {
    color: colors.success,
  },
  walletTextError: {
    color: colors.error,
  },
  walletBalance: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semibold,
  },
  walletInsufficientWrap: {
    marginTop: 10,
    gap: 10,
  },
  rechargeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  rechargeButtonText: {
    fontSize: fontSize.md,
    fontFamily: fonts.semibold,
    color: "#fff",
  },

  // Empty states
  emptyTitle: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semibold,
    color: colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default withSignIn(TomorrowsBasketScreen, "basket-outline", () => ({
  title: strings("subscriptions").basket.signInTitle,
  message: strings("subscriptions").basket.signInMessage,
}));
