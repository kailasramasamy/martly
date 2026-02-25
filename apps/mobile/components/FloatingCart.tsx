import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../lib/cart-context";
import { colors, spacing, fontSize } from "../constants/theme";

export function FloatingCart() {
  const { itemCount, totalAmount, storeName } = useCart();

  if (itemCount === 0) return null;

  return (
    <View style={styles.wrapper}>
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
            <Text style={styles.total}>₹{totalAmount.toFixed(0)}</Text>
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
    backgroundColor: colors.background,
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
    backgroundColor: "#fff",
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
    color: colors.primary,
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
