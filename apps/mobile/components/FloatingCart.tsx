import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../lib/cart-context";
import { useBasketMode } from "../lib/basket-mode-context";
import { colors, spacing, fontSize } from "../constants/theme";

// aboveTabBar: rendered inside a tab screen, where the tab bar already covers the bottom safe area
export function FloatingCart({ aboveTabBar = false }: { aboveTabBar?: boolean }) {
  const { itemCount, totalAmount, storeName } = useCart();
  const { isBasketMode, itemCount: basketItemCount, exitBasketMode } = useBasketMode();
  const insets = useSafeAreaInsets();
  const paddingBottom = aboveTabBar ? 10 : Math.max(12, insets.bottom + 8);

  // Basket mode bar takes priority
  if (isBasketMode) {
    return (
      <View style={[styles.wrapper, { paddingBottom }]}>
        <TouchableOpacity
          style={styles.bar}
          activeOpacity={0.9}
          onPress={() => {
            exitBasketMode();
            router.push("/tomorrows-basket");
          }}
        >
          <View style={styles.left}>
            <View style={styles.basketIcon}>
              <Ionicons name="basket" size={18} color="#fff" />
            </View>
            <View style={styles.info}>
              <Text style={styles.storeName} numberOfLines={1}>Adding to tomorrow's basket</Text>
              {basketItemCount > 0 && (
                <Text style={styles.basketCount}>
                  {basketItemCount} item{basketItemCount !== 1 ? "s" : ""} added
                </Text>
              )}
            </View>
          </View>
          <View style={styles.right}>
            <Text style={styles.viewCart}>View Basket</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  if (itemCount === 0) return null;

  return (
    <View style={[styles.wrapper, { paddingBottom }]}>
      <TouchableOpacity
        style={styles.bar}
        activeOpacity={0.9}
        onPress={() => router.push("/(tabs)/cart")}
      >
        <View style={styles.left}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{itemCount > 9 ? "9+" : itemCount}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
            <Text style={styles.total}>{"\u20B9"}{totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Text>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.viewCart}>View Cart</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
    paddingTop: 6,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accentText,
  },
  basketIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    marginLeft: 10,
    flex: 1,
  },
  storeName: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  total: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: "#fff",
  },
  basketCount: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: "#fff",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  viewCart: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: "#fff",
  },
});
