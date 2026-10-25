import { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Loader } from "../Loader";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useStore } from "../../lib/store-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { ProductActionsProvider } from "../../lib/product-actions";
import { useTabBarAutoHide } from "../../lib/tab-bar-visibility";
import type { CartReview, StoreProduct } from "../../lib/types";
import { useReorder } from "../orders/use-reorder";
import { useLastOrderId } from "../orders/use-last-order-id";
import { BuyAgainSheet } from "../order/BuyAgainSheet";
import { SuggestionRail } from "./SuggestionRail";
import { colors, spacing, fontSize } from "../../constants/theme";

// The shopper's due usual items at the selected store (a cart review with no lines); none for guests
function useUsualItems(storeId: string | undefined) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<StoreProduct[]>([]);
  useFocusEffect(useCallback(() => {
    if (!isAuthenticated || !storeId) return setItems([]);
    let live = true;
    api.post<CartReview>("/api/v1/cart/review", { storeId, lines: [] })
      .then((res) => live && setItems(res.data.forgotten))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isAuthenticated, storeId]));
  return items;
}

/** An empty cart that restarts the habit: the last order again, and the usual items that are due */
export function EmptyCart() {
  const t = useStrings("cart");
  const { selectedStore } = useStore();
  const usual = useUsualItems(selectedStore?.id);
  const lastOrderId = useLastOrderId();
  const reorder = useReorder();
  // Brings the tab bar back when the cart empties while it was scrolled away
  const tabBarScroll = useTabBarAutoHide();

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <ScrollView {...tabBarScroll.scrollProps} style={styles.screen} contentContainerStyle={tabBarScroll.contentStyle(styles.content)}>
        <View style={styles.hero}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cart-outline" size={64} color={colors.border} />
          </View>
          <Text style={styles.emptyTitle}>{t.emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{t.emptySubtitle}</Text>
          <View style={styles.actions}>
            {lastOrderId && (
              <TouchableOpacity
                style={[styles.button, styles.buttonOutline]}
                onPress={() => reorder.reorder(lastOrderId)}
                disabled={reorder.reorderingId === lastOrderId}
              >
                {reorder.reorderingId === lastOrderId ? (
                  <Loader size="small" />
                ) : (
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                )}
                <Text style={[styles.buttonText, styles.buttonOutlineText]}>{t.repeatLastOrder}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.button} onPress={() => router.push("/(tabs)")}>
              <Ionicons name="storefront-outline" size={18} color="#fff" />
              <Text style={styles.buttonText}>{t.browseStores}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <SuggestionRail title={t.usualTitle} products={usual} />
      </ScrollView>
      <BuyAgainSheet choices={reorder.choices} onAdd={reorder.addPicked} onClose={reorder.closeChoices} />
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  hero: { alignItems: "center", paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  emptySubtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  actions: { alignSelf: "stretch", gap: 10, marginTop: spacing.lg },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
  },
  buttonOutline: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.primary },
  buttonText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
  buttonOutlineText: { color: colors.primary },
});
