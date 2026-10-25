import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../../lib/cart-context";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { useCartRemoval } from "../../components/cart/use-cart-removal";
import { useStore } from "../../lib/store-context";
import { useMembership } from "../../lib/membership-context";
import { colors, spacing, fontSize } from "../../constants/theme";
import { ProductActionsProvider } from "../../lib/product-actions";
import { TabBottomDock } from "../../components/TabIcon";
import { useTabBarAutoHide } from "../../lib/tab-bar-visibility";
import { RewardsReminder } from "../../components/cart/RewardsReminder";
import { CartLine } from "../../components/cart/CartLine";
import { CartBill } from "../../components/cart/CartBill";
import { OrderGoal } from "../../components/cart/OrderGoal";
import { SuggestionRail } from "../../components/cart/SuggestionRail";
import { useCartReview } from "../../components/cart/use-cart-review";
import { CouponHint, PlusHint } from "../../components/cart/CartHints";
import { EmptyCart } from "../../components/cart/EmptyCart";
import { CartWalkNudge } from "../../components/store-walk/WalkNudge";
import { useRequireSignIn } from "../../lib/sign-in-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { useAuth } from "../../lib/auth-context";
import { SaveAsMonthlyList } from "../../components/monthly-list/SaveAsMonthlyList";

export default function CartScreen() {
  const requireSignIn = useRequireSignIn();
  const t = useStrings("cart");
  const ml = useStrings("monthlyList");
  const { isAuthenticated } = useAuth();
  const tabBarScroll = useTabBarAutoHide();
  // Height of the footer docked above the tab bar, so the list scrolls clear of it
  const [dockHeight, setDockHeight] = useState(0);
  const router = useRouter();
  const { store, storeId, storeName, items, totalAmount, itemCount, updateQuantity, removeItem, pendingCoupon } = useCart();
  const removal = useCartRemoval();
  const { selectedStore } = useStore();
  const { freeDelivery: memberFreeDelivery } = useMembership();

  const minOrderAmount = selectedStore?.minOrderAmount ? Number(selectedStore.minOrderAmount) : null;
  const freeDeliveryThreshold = selectedStore?.freeDeliveryThreshold ? Number(selectedStore.freeDeliveryThreshold) : null;
  const belowMinimum = minOrderAmount != null && totalAmount < minOrderAmount;
  const baseDeliveryFee = selectedStore?.baseDeliveryFee ? Number(selectedStore.baseDeliveryFee) : 0;
  const thresholdFreeDelivery = freeDeliveryThreshold != null && totalAmount >= freeDeliveryThreshold;
  const cartFreeDelivery = memberFreeDelivery || thresholdFreeDelivery;
  const belowFreeDelivery = !cartFreeDelivery && freeDeliveryThreshold != null && totalAmount < freeDeliveryThreshold && !belowMinimum;
  const goal = belowMinimum
    ? { kind: "minimum" as const, target: minOrderAmount! }
    : belowFreeDelivery ? { kind: "freeDelivery" as const, target: freeDeliveryThreshold! } : null;
  const review = useCartReview(goal ? goal.target - totalAmount : null);
  const deliveryFee = cartFreeDelivery ? 0 : baseDeliveryFee > 0 ? baseDeliveryFee : null;
  // The applied coupon comes off here too, as checkout will take it off; it's re-validated there
  const coupon = review.coupon?.eligible && review.coupon.code === pendingCoupon
    ? { code: review.coupon.code, amount: review.coupon.discount ?? 0 }
    : null;
  const grandTotal = totalAmount + (deliveryFee ?? 0) - (coupon?.amount ?? 0);
  const savings = review.savings + (coupon?.amount ?? 0);
  // Below the minimum the bar is grey; unavailable lines turn it into the button that removes them
  const checkoutLocked = belowMinimum && !review.hasUnavailable;
  const removeUnavailable = () => {
    for (const i of items) if (review.statusOf(i.storeProductId, i.quantity, i.price).unavailable) removeItem(i.storeProductId);
  };
  const onCheckout = () => {
    if (review.hasUnavailable) removeUnavailable();
    else if (!belowMinimum) requireSignIn(() => router.push("/checkout"), { title: t.signInTitle, subtitle: t.signInSubtitle });
  };

  if (items.length === 0) return <EmptyCart />;

  return (
    <ProductActionsProvider store={store}>
      <View style={styles.container}>
        {/* Store Header */}
        <View style={styles.storeHeader}>
          <View style={styles.storeIconWrap}>
            <Ionicons name="storefront" size={16} color={colors.primary} />
          </View>
          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{storeName}</Text>
            <Text style={styles.itemCountLabel}>{t.itemsInCart(itemCount)}</Text>
          </View>
          <TouchableOpacity style={styles.clearBtn} onPress={removal.askClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
            <Text style={styles.clearText}>{t.clearCart}</Text>
          </TouchableOpacity>
        </View>

        {goal && <OrderGoal kind={goal.kind} target={goal.target} total={totalAmount} />}

        <FlatList {...tabBarScroll.scrollProps}
          data={items}
          keyExtractor={(item) => item.storeProductId}
          contentContainerStyle={tabBarScroll.contentStyle(styles.list, dockHeight)}
          renderItem={({ item, index }) => (
            <CartLine
              item={item}
              status={review.statusOf(item.storeProductId, item.quantity, item.price)}
              deal={review.packDealFor(item.storeProductId)}
              onSwitch={review.switchPack}
              onDecrement={() => (item.quantity === 1 ? removal.removeAt(index) : updateQuantity(item.storeProductId, item.quantity - 1))}
              onIncrement={() => updateQuantity(item.storeProductId, item.quantity + 1)}
              onRemove={() => removal.removeAt(index)}
            />
          )}
          ListFooterComponent={
            <View>
              <CartWalkNudge />
              {/* Due usual items first: the likeliest adds, and they close the gap too */}
              <SuggestionRail title={t.forgotTitle} subtitle={t.forgotSubtitle} products={review.forgotten} />
              <SuggestionRail title={t.gapRailTitle} products={review.gapFillers} />
              {review.forgotten.length === 0 && <SuggestionRail title={t.alsoBought} products={review.alsoBought} />}
              <RewardsReminder storeId={storeId ?? undefined} />
              <CouponHint coupon={review.coupon} />
              {!cartFreeDelivery && <PlusHint offer={review.plusOffer} />}
              <CartBill
                itemTotal={totalAmount}
                deliveryFee={deliveryFee}
                freeDelivery={cartFreeDelivery}
                memberFreeDelivery={memberFreeDelivery}
                coupon={coupon}
                grandTotal={grandTotal}
                savings={savings}
              />
              {isAuthenticated && storeId && storeId === selectedStore?.id && (
                <View style={styles.monthly}>
                  <SaveAsMonthlyList
                    storeId={storeId} label={ml.fromCart}
                    from={{ source: "LINES", lines: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })) }}
                  />
                </View>
              )}
            </View>
          }
        />

        {/* Sticky footer, docked above the tab bar */}
        <TabBottomDock onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.checkoutBar, checkoutLocked && styles.checkoutBarDisabled]}
            activeOpacity={checkoutLocked ? 1 : 0.9}
            onPress={onCheckout}
          >
            <View>
              <View style={styles.checkoutLeft}>
                <Text style={styles.checkoutTotal}>{"\u20B9"}{grandTotal.toFixed(0)}</Text>
                <Text style={styles.checkoutSubtext}>{t.total}</Text>
              </View>
              {savings >= 1 && <Text style={styles.checkoutSaved}>{t.saved(savings.toFixed(0))}</Text>}
            </View>
            <View style={styles.checkoutRight}>
              <Text style={styles.checkoutBtnText}>
                {review.hasUnavailable ? t.removeUnavailable : belowMinimum ? t.minOrder(minOrderAmount!.toFixed(0)) : t.checkout}
              </Text>
              {!review.hasUnavailable && <Ionicons name={belowMinimum ? "lock-closed" : "arrow-forward"} size={18} color="#fff" />}
            </View>
          </TouchableOpacity>
        </View>
        </TabBottomDock>
        <ConfirmSheet
          visible={removal.confirmClear}
          title={t.clearTitle}
          message={t.clearMessage(itemCount)}
          icon="trash-outline"
          iconColor="#ef4444"
          confirmLabel={t.clearConfirm}
          onConfirm={removal.clearAll}
          onCancel={removal.cancelClear}
        />
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  monthly: { marginHorizontal: 16, marginTop: 12 },
  container: { flex: 1, backgroundColor: colors.surface },
  // Store header
  storeHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  storeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary + "14",
    justifyContent: "center",
    alignItems: "center",
  },
  storeInfo: { marginLeft: 12, flex: 1 },
  clearBtn: { minHeight: 44, justifyContent: "center", paddingLeft: 12 },
  clearText: { fontSize: fontSize.md, fontWeight: "700", color: colors.error },
  storeName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  itemCountLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  list: { padding: spacing.md, paddingBottom: spacing.sm },
  // Footer
  footer: {
    padding: spacing.md,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkoutBar: {
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
  checkoutLeft: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  checkoutTotal: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  checkoutSubtext: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  // Light amber stays legible at 11px on the teal bar
  checkoutSaved: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fde68a",
    marginTop: 2,
  },
  checkoutRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  checkoutBarDisabled: {
    backgroundColor: "#94a3b8",
    shadowOpacity: 0,
    elevation: 0,
  },
  checkoutBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
