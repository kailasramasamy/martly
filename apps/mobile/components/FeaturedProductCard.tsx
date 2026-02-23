import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import type { StoreProduct } from "../lib/types";

export const FEATURED_CARD_WIDTH = 156;

interface FeaturedProductCardProps {
  item: StoreProduct;
  onAddToCart: (sp: StoreProduct) => void;
  onUpdateQuantity: (storeProductId: string, quantity: number) => void;
  quantity?: number;
  storeId?: string;
}

export function FeaturedProductCard({ item, onAddToCart, onUpdateQuantity, quantity = 0, storeId }: FeaturedProductCardProps) {
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
  const brandName = item.product.brand?.name;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
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

        {discountLabel && (
          <View style={styles.discountTag}>
            <Text style={styles.discountText}>{discountLabel}</Text>
          </View>
        )}

        {isOutOfStock && (
          <View style={styles.oosOverlay}>
            <Text style={styles.oosLabel}>Out of stock</Text>
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
      </View>

      {/* Content */}
      <View style={styles.content}>
        {brandName && (
          <Text style={styles.brand} numberOfLines={1}>{brandName}</Text>
        )}
        <Text style={styles.name} numberOfLines={2}>{item.product.name}</Text>
        <Text style={styles.unit} numberOfLines={1}>
          {item.variant.unitValue && item.variant.unitType
            ? `${item.variant.unitValue} ${item.variant.unitType}`
            : item.variant.name}
        </Text>

        {isLowStock && (
          <Text style={styles.lowStock}>Only {available} left</Text>
        )}

        {/* Price + Add */}
        <View style={styles.footer}>
          <View style={styles.priceColumn}>
            <Text style={styles.price}>₹{displayPrice.toFixed(0)}</Text>
            {originalPrice != null && (
              <Text style={styles.mrp}>₹{originalPrice.toFixed(0)}</Text>
            )}
          </View>
          {quantity > 0 ? (
            <View style={styles.qtyStepper}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => onUpdateQuantity(item.id, quantity - 1)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={quantity === 1 ? "trash-outline" : "remove"} size={14} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => onAddToCart(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="add" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.addBtn,
                isOutOfStock && styles.addBtnDisabled,
              ]}
              onPress={() => onAddToCart(item)}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? (
                <Text style={styles.addBtnTextDisabled}>ADD</Text>
              ) : (
                <Text style={styles.addBtnText}>ADD</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: FEATURED_CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginRight: 12,
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
    fontSize: 32,
    fontWeight: "700",
    color: "#94a3b8",
  },
  foodIndicator: {
    position: "absolute",
    bottom: 6,
    left: 6,
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
    left: 0,
    backgroundColor: "#dc2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  discountText: { fontSize: 9, color: "#fff", fontWeight: "700", letterSpacing: 0.3 },
  oosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  oosLabel: { fontSize: 11, fontWeight: "700", color: colors.error },
  content: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  brand: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 17,
  },
  unit: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  lowStock: {
    fontSize: 10,
    color: colors.warning,
    fontWeight: "600",
    marginTop: 2,
  },
  priceColumn: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 20,
  },
  mrp: {
    fontSize: 11,
    color: "#94a3b8",
    textDecorationLine: "line-through",
  },
  addBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: "#fff",
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 6,
    backgroundColor: colors.primary + "08",
    overflow: "hidden",
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    minWidth: 18,
    textAlign: "center",
  },
  addBtnDisabled: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  addBtnTextDisabled: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
  },
});
