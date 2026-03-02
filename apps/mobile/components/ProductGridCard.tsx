import { useRef } from "react";
import { View, Text, TouchableOpacity, Pressable, Image, StyleSheet, Dimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../constants/theme";
import type { StoreProduct } from "../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
export const GRID_GAP = 12;
export const GRID_H_PADDING = spacing.md;
export const GRID_CARD_WIDTH = (SCREEN_WIDTH - GRID_H_PADDING * 2 - GRID_GAP) / 2;
export const GRID_IMAGE_HEIGHT = Math.round(GRID_CARD_WIDTH * 0.65);

interface ProductGridCardProps {
  item: StoreProduct;
  onAddToCart: (sp: StoreProduct) => void;
  onUpdateQuantity?: (storeProductId: string, quantity: number) => void;
  quantity?: number;
  storeId?: string;
  variantCount?: number;
  onShowVariants?: () => void;
  containerWidth?: number;
  variantSizes?: string[];
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string) => void;
  isMember?: boolean;
}

export function ProductGridCard({ item, onAddToCart, quantity = 0, storeId, variantCount = 1, onShowVariants, containerWidth, variantSizes, isWishlisted, onToggleWishlist, isMember }: ProductGridCardProps) {
  const cardWidth = containerWidth
    ? (containerWidth - GRID_GAP) / 2
    : GRID_CARD_WIDTH;
  const hasDiscount = item.pricing?.discountActive;
  const displayPrice = hasDiscount ? item.pricing!.effectivePrice : Number(item.price);
  const originalPrice = hasDiscount ? item.pricing!.originalPrice : null;
  const discountLabel = hasDiscount
    ? item.pricing!.discountType === "PERCENTAGE"
      ? `${item.pricing!.discountValue}% OFF`
      : `₹${item.pricing!.discountValue} OFF`
    : null;
  const productImage = item.product.imageUrl || item.variant.imageUrl;
  const available = item.availableStock ?? (item.stock - (item.reservedStock ?? 0));
  const isOutOfStock = available <= 0;
  const isLowStock = !isOutOfStock && available <= 5;
  const heartTapped = useRef(false);

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={() => {
        if (heartTapped.current) { heartTapped.current = false; return; }
        const params: Record<string, string> = { id: item.product.id };
        if (storeId) params.storeId = storeId;
        router.push({ pathname: "/product/[id]", params });
      }}
      activeOpacity={0.7}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        {productImage ? (
          <Image source={{ uri: productImage }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={[styles.image, styles.noImage]}>
            <Text style={styles.noImageLetter}>{item.product.name.charAt(0)}</Text>
          </View>
        )}

        {item.product.foodType && (
          <View style={[
            styles.foodIndicator,
            (item.product.foodType === "VEG" || item.product.foodType === "VEGAN")
              ? styles.vegBorder : styles.nvBorder,
          ]}>
            <View style={[
              styles.foodDot,
              (item.product.foodType === "VEG" || item.product.foodType === "VEGAN")
                ? styles.vegFill : styles.nvFill,
            ]} />
          </View>
        )}

        {discountLabel && (
          <View style={styles.discountTag}>
            <Text style={styles.discountText}>{discountLabel}</Text>
          </View>
        )}

        {onToggleWishlist && (
          <Pressable
            style={styles.heartBtn}
            onPress={() => { heartTapped.current = true; onToggleWishlist(item.product.id); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={isWishlisted ? "heart" : "heart-outline"} size={18} color={isWishlisted ? "#ef4444" : "#94a3b8"} />
          </Pressable>
        )}

        {isOutOfStock && (
          <View style={styles.oosOverlay}>
            <Text style={styles.oosLabel}>Out of stock</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>{item.product.name}</Text>
        {variantSizes && variantSizes.length > 1 ? (
          <Text style={styles.variant} numberOfLines={1}>
            {variantSizes.join(" · ")}
          </Text>
        ) : (
          <Text style={styles.variant} numberOfLines={1}>{item.variant.name}</Text>
        )}
        {(item.product.averageRating ?? 0) > 0 && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={11} color="#f59e0b" />
            <Text style={styles.ratingText}>{item.product.averageRating!.toFixed(1)}</Text>
            {(item.product.reviewCount ?? 0) > 0 && (
              <Text style={styles.ratingCount}>({item.product.reviewCount})</Text>
            )}
          </View>
        )}
        {isLowStock && <Text style={styles.lowStock}>Only {available} left</Text>}

        <View style={styles.footer}>
          <View>
            {isMember && item.pricing?.memberPrice != null && item.pricing.memberPrice < displayPrice ? (
              <>
                <Text style={styles.price}>{"\u20B9"}{item.pricing.memberPrice.toFixed(0)}</Text>
                <Text style={styles.mrp}>{"\u20B9"}{displayPrice.toFixed(0)}</Text>
              </>
            ) : (
              <>
                <Text style={styles.price}>{"\u20B9"}{displayPrice.toFixed(0)}</Text>
                {originalPrice != null && (
                  <Text style={styles.mrp}>{"\u20B9"}{originalPrice.toFixed(0)}</Text>
                )}
              </>
            )}
            {!isMember && item.pricing?.memberPrice != null && item.pricing.memberPrice < displayPrice && (
              <Text style={{ fontSize: 9, color: "#7c3aed", fontWeight: "600" }}>{"\u20B9"}{item.pricing.memberPrice.toFixed(0)} for members</Text>
            )}
          </View>
          {quantity > 0 ? (
            <TouchableOpacity
              style={styles.qtyBadge}
              onPress={onShowVariants}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark" size={12} color="#fff" />
              <Text style={styles.qtyBadgeText}>{quantity}</Text>
            </TouchableOpacity>
          ) : variantCount > 1 ? (
            <TouchableOpacity
              style={styles.stackedBtn}
              onPress={onShowVariants}
              activeOpacity={0.7}
            >
              <View style={styles.optionsBtn}>
                <Text style={styles.optionsBtnText}>{variantCount} options</Text>
              </View>
              <View style={styles.stackedAddBtn}>
                <Text style={styles.stackedAddBtnText}>ADD</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.addBtn, isOutOfStock && styles.addBtnDisabled]}
              onPress={() => onAddToCart(item)}
              disabled={isOutOfStock}
            >
              <Text style={[styles.addBtnText, isOutOfStock && styles.addBtnTextDisabled]}>
                {isOutOfStock ? "N/A" : "ADD"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: GRID_CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: GRID_GAP,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#f1f5f9",
    position: "relative",
  },
  image: { width: "100%", height: "100%" },
  noImage: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e2e8f0",
  },
  noImageLetter: {
    fontSize: 36,
    fontWeight: "700",
    color: "#94a3b8",
  },
  foodIndicator: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 3,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  vegBorder: { borderColor: "#0a8f08" },
  nvBorder: { borderColor: "#b71c1c" },
  foodDot: { width: 8, height: 8, borderRadius: 4 },
  vegFill: { backgroundColor: "#0a8f08" },
  nvFill: { backgroundColor: "#b71c1c" },
  discountTag: {
    position: "absolute",
    top: 8,
    right: 0,
    backgroundColor: "#dc2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  discountText: { fontSize: 9, color: "#fff", fontWeight: "700" },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  oosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  oosLabel: { fontSize: 12, fontWeight: "700", color: colors.error },
  content: { padding: 10 },
  name: { fontSize: 13, fontWeight: "600", color: colors.text, lineHeight: 17, minHeight: 34 },
  variant: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  ratingText: { fontSize: 11, fontWeight: "600", color: "#92400e" },
  ratingCount: { fontSize: 10, color: "#94a3b8" },
  lowStock: { fontSize: 10, color: colors.warning, fontWeight: "600", marginTop: 2 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 8,
  },
  price: { fontSize: 15, fontWeight: "700", color: colors.text },
  mrp: { fontSize: 11, color: colors.textSecondary, textDecorationLine: "line-through" },
  addBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: "#fff",
  },
  addBtnDisabled: { borderColor: colors.border, backgroundColor: colors.surface },
  addBtnText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  addBtnTextDisabled: { color: colors.textSecondary },
  stackedBtn: {
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  optionsBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  optionsBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  stackedAddBtn: {
    backgroundColor: "#fff",
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  stackedAddBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  qtyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  qtyBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
});
