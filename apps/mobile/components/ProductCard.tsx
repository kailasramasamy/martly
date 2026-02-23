import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize } from "../constants/theme";
import type { StoreProduct } from "../lib/types";

interface ProductCardProps {
  item: StoreProduct;
  variantCount?: number;
  onAddToCart: (sp: StoreProduct) => void;
  onUpdateQuantity: (storeProductId: string, quantity: number) => void;
  quantity?: number;
  storeId?: string;
}

export function ProductCard({ item, variantCount = 1, onAddToCart, onUpdateQuantity, quantity = 0, storeId }: ProductCardProps) {
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

  const handlePress = () => {
    const params: Record<string, string> = { id: item.product.id };
    if (storeId) params.storeId = storeId;
    router.push({ pathname: "/product/[id]", params });
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.cardBody}>
        {/* Product image with variant count badge */}
        <View style={styles.imageContainer}>
          {productImage ? (
            <Image source={{ uri: productImage }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={[styles.productImage, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderLetter}>{item.product.name.charAt(0)}</Text>
            </View>
          )}
          {variantCount > 1 && (
            <View style={styles.variantCountBadge}>
              <Text style={styles.variantCountText}>{variantCount}</Text>
            </View>
          )}
          {discountLabel && (
            <View style={styles.imageDiscountTag}>
              <Text style={styles.imageDiscountText}>{discountLabel}</Text>
            </View>
          )}
          {isOutOfStock && (
            <View style={styles.imageOosOverlay}>
              <Text style={styles.imageOosText}>Out of{"\n"}stock</Text>
            </View>
          )}
        </View>

        {/* Card content */}
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            {item.product.foodType && (
              <View
                style={[
                  styles.foodTypeDot,
                  item.product.foodType === "VEG" || item.product.foodType === "VEGAN"
                    ? styles.foodTypeVeg
                    : styles.foodTypeNonVeg,
                ]}
              >
                <View
                  style={[
                    styles.foodTypeDotInner,
                    item.product.foodType === "VEG" || item.product.foodType === "VEGAN"
                      ? styles.foodTypeDotVeg
                      : styles.foodTypeDotNonVeg,
                  ]}
                />
              </View>
            )}
            {item.product.brand?.name && (
              <Text style={styles.brandName}>{item.product.brand.name}</Text>
            )}
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.productName} numberOfLines={2}>{item.product.name}</Text>
            <View style={styles.priceGroup}>
              {originalPrice != null && (
                <Text style={styles.mrpPrice}>₹{originalPrice.toFixed(2)}</Text>
              )}
              {!hasDiscount && item.variant.mrp != null && Number(item.variant.mrp) > Number(item.price) && (
                <Text style={styles.mrpPrice}>₹{Number(item.variant.mrp).toFixed(2)}</Text>
              )}
              <Text style={styles.price}>₹{displayPrice.toFixed(2)}</Text>
            </View>
          </View>
          <Text style={styles.variantInfo}>
            {item.variant.name} · {item.variant.unitType} {item.variant.unitValue}
          </Text>
          {isLowStock && (
            <Text style={styles.lowStockText}>Only {available} left</Text>
          )}
          {item.product.description && (
            <Text style={styles.description} numberOfLines={2}>{item.product.description}</Text>
          )}
        </View>
      </View>

      {item.product.regulatoryMarks?.length > 0 && (
        <View style={styles.badgeRow}>
          {item.product.regulatoryMarks.map((mark: string) => (
            <View key={mark} style={styles.regBadge}>
              <Text style={styles.regBadgeText}>{mark}</Text>
            </View>
          ))}
        </View>
      )}
      {item.product.certifications?.length > 0 && (
        <View style={styles.badgeRow}>
          {item.product.certifications.map((cert: string) => (
            <View key={cert} style={styles.certBadge}>
              <Text style={styles.certBadgeText}>{cert}</Text>
            </View>
          ))}
        </View>
      )}
      {item.product.dangerWarnings && (
        <View style={styles.dangerBanner}>
          <Text style={styles.dangerBannerText}>{item.product.dangerWarnings}</Text>
        </View>
      )}

      {quantity > 0 ? (
        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => onUpdateQuantity(item.id, quantity - 1)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={quantity === 1 ? "trash-outline" : "remove"} size={16} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => onAddToCart(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.addButton, isOutOfStock && styles.disabledButton]}
          onPress={() => onAddToCart(item)}
          disabled={isOutOfStock}
        >
          <Text style={[styles.addButtonText, isOutOfStock && styles.disabledButtonText]}>
            {isOutOfStock ? "Out of Stock" : "Add to Cart"}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { flexDirection: "row", gap: spacing.sm },
  imageContainer: { position: "relative" },
  productImage: { width: 88, height: 88, borderRadius: 10, backgroundColor: "#f8faf8" },
  imagePlaceholder: { justifyContent: "center", alignItems: "center", backgroundColor: "#f0f4f0" },
  imagePlaceholderLetter: { fontSize: 32, fontWeight: "700", color: colors.primary + "30" },
  imageDiscountTag: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#dc2626",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 8,
  },
  imageDiscountText: { fontSize: 8, color: "#fff", fontWeight: "700", letterSpacing: 0.2 },
  imageOosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  imageOosText: { fontSize: 10, fontWeight: "700", color: colors.error, textAlign: "center" },
  variantCountBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  variantCountText: { fontSize: 10, color: "#fff", fontWeight: "700" },
  cardContent: { flex: 1 },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  foodTypeDot: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  foodTypeVeg: { borderColor: "#0a8f08" },
  foodTypeNonVeg: { borderColor: "#b71c1c" },
  foodTypeDotInner: { width: 8, height: 8, borderRadius: 4 },
  foodTypeDotVeg: { backgroundColor: "#0a8f08" },
  foodTypeDotNonVeg: { backgroundColor: "#b71c1c" },
  brandName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase" },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  productName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text, flex: 1 },
  priceGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  mrpPrice: { fontSize: fontSize.sm, color: colors.textSecondary, textDecorationLine: "line-through" },
  price: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.primary },
  variantInfo: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  description: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: spacing.xs },
  regBadge: { backgroundColor: "#e6f0ff", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  regBadgeText: { fontSize: 10, color: "#1a56db", fontWeight: "600" },
  certBadge: { backgroundColor: "#e6f9e6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  certBadgeText: { fontSize: 10, color: "#166534", fontWeight: "600" },
  dangerBanner: {
    backgroundColor: "#fef3c7",
    borderRadius: 4,
    padding: spacing.xs,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  dangerBannerText: { fontSize: 10, color: "#92400e" },
  lowStockText: { fontSize: 10, color: "#f59e0b", fontWeight: "600", marginTop: 2 },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-end",
    marginTop: spacing.sm,
  },
  disabledButton: { backgroundColor: colors.border },
  addButtonText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600" },
  disabledButtonText: { color: colors.textSecondary },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 6,
    backgroundColor: colors.primary + "08",
    overflow: "hidden",
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
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
});
