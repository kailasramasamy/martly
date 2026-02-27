import { useState, useEffect, useCallback } from "react";
import { View, Text, Image, FlatList, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../../lib/cart-context";
import { api } from "../../lib/api";
import type { Banner } from "../../lib/types";
import { colors, spacing, fontSize } from "../../constants/theme";

export default function CartScreen() {
  const router = useRouter();
  const { storeId, storeName, items, totalAmount, itemCount, updateQuantity, removeItem } = useCart();
  const [upsellBanners, setUpsellBanners] = useState<Banner[]>([]);

  useEffect(() => {
    if (!storeId) {
      setUpsellBanners([]);
      return;
    }
    api
      .get<Banner[]>(`/api/v1/banners/by-placement/${storeId}?placement=CART_UPSELL`)
      .then((res) => setUpsellBanners(res.data))
      .catch(() => {});
  }, [storeId]);

  const handleBannerPress = useCallback((banner: Banner) => {
    switch (banner.actionType) {
      case "CATEGORY":
        if (banner.actionTarget) router.push({ pathname: "/category/[id]", params: { id: banner.actionTarget } } as any);
        break;
      case "PRODUCT":
        if (banner.actionTarget) router.push({ pathname: "/product/[id]", params: { id: banner.actionTarget } } as any);
        break;
      case "COLLECTION":
        if (banner.actionTarget) router.push({ pathname: "/search", params: { collectionId: banner.actionTarget } } as any);
        break;
      case "SEARCH":
        if (banner.actionTarget) router.push({ pathname: "/search", params: { q: banner.actionTarget } } as any);
        break;
    }
  }, [router]);

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cart-outline" size={64} color={colors.border} />
        </View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>
          Browse stores and add items to get started
        </Text>
        <TouchableOpacity style={styles.browseButton} onPress={() => router.push("/(tabs)")}>
          <Ionicons name="storefront-outline" size={18} color="#fff" />
          <Text style={styles.browseButtonText}>Browse Stores</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Store Header */}
      <View style={styles.storeHeader}>
        <View style={styles.storeIconWrap}>
          <Ionicons name="storefront" size={16} color={colors.primary} />
        </View>
        <View style={styles.storeInfo}>
          <Text style={styles.storeName}>{storeName}</Text>
          <Text style={styles.itemCountLabel}>{itemCount} item{itemCount !== 1 ? "s" : ""} in cart</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.storeProductId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          upsellBanners.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.upsellList}
            >
              {upsellBanners.map((banner) => (
                <TouchableOpacity
                  key={banner.id}
                  activeOpacity={banner.actionType === "NONE" ? 1 : 0.85}
                  onPress={() => handleBannerPress(banner)}
                  style={styles.upsellCard}
                >
                  <Image source={{ uri: banner.imageUrl }} style={styles.upsellImage} resizeMode="cover" />
                  <View style={styles.upsellTextOverlay}>
                    <Text style={styles.upsellTitle} numberOfLines={1}>{banner.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardBody}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
              ) : (
                <View style={styles.itemImagePlaceholder}>
                  <Ionicons name="cube-outline" size={20} color={colors.border} />
                </View>
              )}
              <View style={styles.cardMiddle}>
                <Text style={styles.itemName} numberOfLines={2}>{item.productName}</Text>
                <Text style={styles.itemVariant}>{item.variantName}</Text>
                <Text style={styles.itemPrice}>
                  {"\u20B9"}{item.price.toFixed(0)}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <View style={styles.qtyStepper}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.storeProductId, item.quantity - 1)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={item.quantity === 1 ? "trash-outline" : "remove"}
                      size={16}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.storeProductId, item.quantity + 1)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="add" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.lineTotal}>
                  {"\u20B9"}{(item.price * item.quantity).toFixed(0)}
                </Text>
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.billSection}>
            <Text style={styles.billTitle}>Bill Details</Text>
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
                <Text style={styles.billGrandLabel}>Grand Total</Text>
                <Text style={styles.billGrandValue}>{"\u20B9"}{totalAmount.toFixed(0)}</Text>
              </View>
            </View>
          </View>
        }
      />

      {/* Sticky Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.checkoutBar}
          activeOpacity={0.9}
          onPress={() => router.push("/checkout")}
        >
          <View style={styles.checkoutLeft}>
            <Text style={styles.checkoutTotal}>{"\u20B9"}{totalAmount.toFixed(0)}</Text>
            <Text style={styles.checkoutSubtext}>TOTAL</Text>
          </View>
          <View style={styles.checkoutRight}>
            <Text style={styles.checkoutBtnText}>Checkout</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
  },
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: spacing.lg,
  },
  browseButtonText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "700",
  },
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
  storeInfo: { marginLeft: 12 },
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
  // Upsell banners
  upsellList: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 10,
  },
  upsellCard: {
    width: 140,
    height: 90,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
  },
  upsellImage: {
    width: "100%",
    height: "100%",
  },
  upsellTextOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  upsellTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  // List
  list: { padding: spacing.md, paddingBottom: spacing.sm },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  itemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  cardMiddle: { flex: 1, marginHorizontal: 12 },
  cardRight: { alignItems: "flex-end", justifyContent: "space-between" },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 20,
  },
  itemVariant: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    backgroundColor: colors.primary + "08",
    overflow: "hidden",
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.primary,
    minWidth: 24,
    textAlign: "center",
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginTop: 6,
  },
  // Bill details
  billSection: {
    marginTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  billTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  billCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  billLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  billValue: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  billFree: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.primary,
  },
  billDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  billGrandLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  billGrandValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
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
  checkoutRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  checkoutBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
