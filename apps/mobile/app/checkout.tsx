import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Linking,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth-context";
import { useCart } from "../lib/cart-context";
import { api } from "../lib/api";
import { colors, spacing, fontSize } from "../constants/theme";
import type { UserAddress } from "../lib/types";

type PaymentMethod = "ONLINE" | "COD";

export default function CheckoutScreen() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { storeId, storeName, items, totalAmount, itemCount, clearCart } = useCart();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ONLINE");
  const [submitting, setSubmitting] = useState(false);

  const fetchAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    try {
      const res = await api.get<UserAddress[]>("/api/v1/addresses");
      setAddresses(res.data);
      // Pre-select default
      const defaultAddr = res.data.find((a) => a.isDefault);
      if (defaultAddr) setSelectedAddressId(defaultAddr.id);
      else if (res.data.length > 0) setSelectedAddressId(res.data[0].id);
      else setUseNewAddress(true);
    } catch {
      setUseNewAddress(true);
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const handlePlaceOrder = async () => {
    const addressId = !useNewAddress ? selectedAddressId : null;
    const deliveryAddress = useNewAddress ? newAddress.trim() : undefined;

    if (!addressId && !deliveryAddress) {
      Alert.alert("Missing Address", "Please select or enter a delivery address.");
      return;
    }

    setSubmitting(true);
    try {
      const orderPayload: Record<string, unknown> = {
        storeId,
        paymentMethod,
        items: items.map((i) => ({
          storeProductId: i.storeProductId,
          quantity: i.quantity,
        })),
      };
      if (addressId) orderPayload.addressId = addressId;
      if (deliveryAddress) orderPayload.deliveryAddress = deliveryAddress;

      const result = await api.post<{ id: string }>("/api/v1/orders", orderPayload);
      const orderId = result.data.id;

      if (paymentMethod === "COD") {
        clearCart();
        Alert.alert("Order Placed!", "Your order has been placed. Pay on delivery.", [
          { text: "View Orders", onPress: () => router.replace("/(tabs)/orders") },
        ]);
        return;
      }

      // Online payment — create Razorpay order
      try {
        const payRes = await api.post<{
          razorpay_order_id: string;
          amount: number;
          currency: string;
          key_id: string;
        }>(`/api/v1/orders/${orderId}/payment`, {});

        // Open Razorpay checkout in browser
        const rpData = payRes.data;
        const checkoutUrl =
          `https://api.razorpay.com/v1/checkout/embedded?key_id=${rpData.key_id}` +
          `&order_id=${rpData.razorpay_order_id}` +
          `&amount=${rpData.amount}` +
          `&currency=${rpData.currency}` +
          `&name=Martly` +
          `&description=Order%20Payment`;

        await Linking.openURL(checkoutUrl);

        // Since we can't get callback from external browser easily,
        // navigate to orders and let user check status
        clearCart();
        Alert.alert(
          "Complete Payment",
          "Complete the payment in your browser. You can check order status in Orders.",
          [{ text: "View Orders", onPress: () => router.replace("/(tabs)/orders") }],
        );
      } catch (payErr: unknown) {
        // Payment gateway unavailable — order still created
        clearCart();
        Alert.alert(
          "Order Created",
          "Order placed but payment gateway is unavailable. Please try paying later from your orders.",
          [{ text: "View Orders", onPress: () => router.replace("/(tabs)/orders") }],
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to place order";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

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

        {/* Delivery Address */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>Delivery Address</Text>
          </View>

          {loadingAddresses ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.addressSection}>
              {addresses.map((addr) => (
                <TouchableOpacity
                  key={addr.id}
                  style={[
                    styles.addressOption,
                    selectedAddressId === addr.id && !useNewAddress && styles.addressOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedAddressId(addr.id);
                    setUseNewAddress(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={
                      selectedAddressId === addr.id && !useNewAddress
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={20}
                    color={
                      selectedAddressId === addr.id && !useNewAddress
                        ? colors.primary
                        : "#94a3b8"
                    }
                  />
                  <View style={styles.addressOptionInfo}>
                    <View style={styles.addressOptionLabelRow}>
                      <Text style={styles.addressOptionLabel}>{addr.label}</Text>
                      {addr.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.addressOptionText} numberOfLines={2}>
                      {addr.address}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {/* New address option */}
              <TouchableOpacity
                style={[styles.addressOption, useNewAddress && styles.addressOptionActive]}
                onPress={() => setUseNewAddress(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={useNewAddress ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={useNewAddress ? colors.primary : "#94a3b8"}
                />
                <View style={styles.addressOptionInfo}>
                  <Text style={styles.addressOptionLabel}>New Address</Text>
                </View>
              </TouchableOpacity>

              {useNewAddress && (
                <View style={styles.newAddressInputWrap}>
                  <TextInput
                    style={styles.addressInput}
                    placeholder="Enter your full delivery address..."
                    placeholderTextColor="#94a3b8"
                    value={newAddress}
                    onChangeText={setNewAddress}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Payment Method */}
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
                    Cash on Delivery
                  </Text>
                  <Text style={styles.paymentCardSub}>Pay when you receive</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

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
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery fee</Text>
              <Text style={styles.billFree}>FREE</Text>
            </View>
            <View style={styles.billDivider} />
            <View style={styles.billRow}>
              <Text style={styles.billGrandLabel}>To Pay</Text>
              <Text style={styles.billGrandValue}>{"\u20B9"}{totalAmount.toFixed(0)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Place Order Bar */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.placeOrderBar, submitting && styles.placeOrderBarDisabled]}
          activeOpacity={0.9}
          onPress={handlePlaceOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <View style={styles.placeOrderLeft}>
                <Text style={styles.placeOrderTotal}>{"\u20B9"}{totalAmount.toFixed(0)}</Text>
                <Text style={styles.placeOrderSubtext}>TOTAL</Text>
              </View>
              <View style={styles.placeOrderRight}>
                <Text style={styles.placeOrderBtnText}>
                  {paymentMethod === "COD" ? "Place Order" : "Pay & Order"}
                </Text>
                <Ionicons name={paymentMethod === "COD" ? "checkmark-circle" : "card"} size={20} color="#fff" />
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>
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

  // Address section
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
  newAddressInputWrap: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginTop: -4,
  },
  addressInput: {
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    lineHeight: 20,
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
});
