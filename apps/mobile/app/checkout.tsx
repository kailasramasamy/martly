import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useCart } from "../lib/cart-context";
import { api } from "../lib/api";
import { colors, spacing, fontSize } from "../constants/theme";

export default function CheckoutScreen() {
  const router = useRouter();
  const { storeId, storeName, items, totalAmount, clearCart } = useCart();
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    if (!deliveryAddress.trim()) {
      Alert.alert("Error", "Please enter a delivery address");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/v1/orders", {
        storeId,
        deliveryAddress: deliveryAddress.trim(),
        items: items.map((i) => ({
          storeProductId: i.storeProductId,
          quantity: i.quantity,
        })),
      });

      clearCart();
      Alert.alert("Order Placed", "Your order has been placed successfully!", [
        { text: "OK", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to place order";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.storeHeader}>
        <Text style={styles.storeName}>{storeName}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.storeProductId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.itemDetail}>
                {item.quantity} x ${item.price.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>${(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>${totalAmount.toFixed(2)}</Text>
            </View>

            <Text style={styles.addressLabel}>Delivery Address</Text>
            <TextInput
              style={styles.addressInput}
              placeholder="Enter your delivery address"
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.orderButton, submitting && styles.orderButtonDisabled]}
              onPress={handlePlaceOrder}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.orderButtonText}>Place Order</Text>
              )}
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  storeHeader: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  storeName: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.text },
  list: { padding: spacing.md },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  itemDetail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  itemTotal: { fontSize: fontSize.md, fontWeight: "bold", color: colors.text },
  footer: { marginTop: spacing.md },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.text,
  },
  totalLabel: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.text },
  totalAmount: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.primary },
  addressLabel: { fontSize: fontSize.md, fontWeight: "600", color: colors.text, marginTop: spacing.md },
  addressInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    minHeight: 80,
    textAlignVertical: "top",
  },
  orderButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  orderButtonDisabled: { opacity: 0.6 },
  orderButtonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "bold" },
});
