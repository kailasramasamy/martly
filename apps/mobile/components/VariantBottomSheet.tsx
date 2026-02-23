import { View, Text, TouchableOpacity, TouchableWithoutFeedback, ScrollView, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize } from "../constants/theme";
import type { StoreProduct } from "../lib/types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MAX = SCREEN_HEIGHT * 0.65;

interface VariantBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  variants: StoreProduct[];
  onAddToCart: (sp: StoreProduct) => void;
  onUpdateQuantity: (storeProductId: string, quantity: number) => void;
  cartQuantityMap: Map<string, number>;
}

export function VariantBottomSheet({
  visible,
  onClose,
  variants,
  onAddToCart,
  onUpdateQuantity,
  cartQuantityMap,
}: VariantBottomSheetProps) {
  if (!visible || variants.length === 0) return null;

  const productName = variants[0].product.name;

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.sheet}>
        <View style={styles.handleBar} />
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>{productName}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>{variants.length} variants available</Text>

        <ScrollView bounces={false}>
          {variants.map((sp) => {
            const hasDiscount = sp.pricing?.discountActive;
            const displayPrice = hasDiscount ? sp.pricing!.effectivePrice : Number(sp.price);
            const originalPrice = hasDiscount ? sp.pricing!.originalPrice : null;
            const available = sp.availableStock ?? (sp.stock - (sp.reservedStock ?? 0));
            const isOutOfStock = available <= 0;
            const qty = cartQuantityMap.get(sp.id) ?? 0;

            return (
              <View key={sp.id} style={styles.variantCard}>
                <View style={styles.variantInfo}>
                  <Text style={styles.variantName}>{sp.variant.name}</Text>
                  <View style={styles.priceRow}>
                    {originalPrice != null && (
                      <Text style={styles.mrpPrice}>₹{originalPrice.toFixed(0)}</Text>
                    )}
                    <Text style={styles.price}>₹{displayPrice.toFixed(0)}</Text>
                  </View>
                  {isOutOfStock && <Text style={styles.outOfStock}>Out of Stock</Text>}
                </View>
                {qty > 0 ? (
                  <View style={styles.qtyStepper}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => onUpdateQuantity(sp.id, qty - 1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name={qty === 1 ? "trash-outline" : "remove"} size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => onAddToCart(sp)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="add" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.addBtn, isOutOfStock && styles.disabledBtn]}
                    onPress={() => onAddToCart(sp)}
                    disabled={isOutOfStock}
                  >
                    <Text style={[styles.addText, isOutOfStock && styles.disabledText]}>
                      {isOutOfStock ? "N/A" : "Add"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: SHEET_MAX,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: 2,
  },
  variantCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variantInfo: { flex: 1 },
  variantName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs },
  mrpPrice: { fontSize: fontSize.sm, color: colors.textSecondary, textDecorationLine: "line-through" },
  price: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.primary },
  outOfStock: { fontSize: fontSize.sm, color: colors.error, fontWeight: "600", marginTop: 2 },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  disabledBtn: { backgroundColor: colors.border },
  addText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600" },
  disabledText: { color: colors.textSecondary },
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
