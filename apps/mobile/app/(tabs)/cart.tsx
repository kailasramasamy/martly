import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useCart } from "../../lib/cart-context";
import { colors, spacing, fontSize } from "../../constants/theme";

export default function CartScreen() {
  const router = useRouter();
  const { storeName, items, totalAmount, itemCount, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>Add items from a store to get started</Text>
        <TouchableOpacity style={styles.browseButton} onPress={() => router.push("/(tabs)")}>
          <Text style={styles.browseButtonText}>Browse Stores</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.storeHeader}>
        <Text style={styles.storeBadge}>{storeName}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.storeProductId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <TouchableOpacity onPress={() => removeItem(item.storeProductId)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() => updateQuantity(item.storeProductId, item.quantity - 1)}
                >
                  <Text style={styles.qtyButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantity}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() => updateQuantity(item.storeProductId, item.quantity + 1)}
                >
                  <Text style={styles.qtyButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.lineTotal}>${(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{itemCount} item{itemCount !== 1 ? "s" : ""}</Text>
          <Text style={styles.totalAmount}>${totalAmount.toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.checkoutButton} onPress={() => router.push("/checkout")}>
          <Text style={styles.checkoutText}>Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: "bold", color: colors.text },
  emptySubtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.sm },
  browseButton: {
    backgroundColor: colors.primary, borderRadius: 8, paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg, marginTop: spacing.lg,
  },
  browseButtonText: { color: "#fff", fontSize: fontSize.md, fontWeight: "600" },
  storeHeader: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  storeBadge: {
    fontSize: fontSize.md, fontWeight: "bold", color: colors.primary,
    backgroundColor: colors.surface, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    borderRadius: 4, overflow: "hidden", alignSelf: "flex-start",
  },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text, flex: 1 },
  removeText: { fontSize: fontSize.sm, color: colors.error },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  quantityRow: { flexDirection: "row", alignItems: "center" },
  qtyButton: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border,
    justifyContent: "center", alignItems: "center",
  },
  qtyButtonText: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.text },
  quantity: { fontSize: fontSize.md, fontWeight: "600", marginHorizontal: spacing.md, color: colors.text },
  lineTotal: { fontSize: fontSize.md, fontWeight: "bold", color: colors.text },
  footer: {
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  totalLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  totalAmount: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.primary },
  checkoutButton: {
    backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, alignItems: "center",
  },
  checkoutText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "bold" },
});
