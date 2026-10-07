import { View, Text, Image, TouchableOpacity, TouchableWithoutFeedback, ScrollView, StyleSheet, Dimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../constants/theme";
import type { StoreProduct } from "../lib/types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MAX = SCREEN_HEIGHT * 0.7;
const CONTROL_WIDTH = 72;
const HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

interface VariantBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  variants: StoreProduct[];
  onAddToCart: (sp: StoreProduct) => void;
  onUpdateQuantity: (storeProductId: string, quantity: number) => void;
  cartQuantityMap: Map<string, number>;
  isMember?: boolean;
  mode?: "cart" | "subscribe";
  onSelect?: (sp: StoreProduct) => void;
}

function getPrices(sp: StoreProduct, isMember?: boolean) {
  const hasDiscount = sp.pricing?.discountActive;
  const displayPrice = hasDiscount ? sp.pricing!.effectivePrice : Number(sp.price);
  const memberPrice = sp.pricing?.memberPrice;
  const memberCheaper = memberPrice != null && memberPrice < displayPrice;
  const discountLabel = hasDiscount
    ? sp.pricing!.discountType === "PERCENTAGE" ? `${sp.pricing!.discountValue}% OFF` : `\u20B9${sp.pricing!.discountValue} OFF`
    : null;
  return {
    shown: isMember && memberCheaper ? memberPrice! : displayPrice,
    struck: isMember && memberCheaper ? displayPrice : hasDiscount ? sp.pricing!.originalPrice : null,
    plusHint: !isMember && memberCheaper ? memberPrice! : null,
    discountLabel,
  };
}

interface ControlProps {
  sp: StoreProduct;
  qty: number;
  isOutOfStock: boolean;
  mode: "cart" | "subscribe";
  onAddToCart: (sp: StoreProduct) => void;
  onUpdateQuantity: (storeProductId: string, quantity: number) => void;
  onSelect?: (sp: StoreProduct) => void;
}

// Mirrors the product card: outlined ADD, solid stepper once in the cart
function VariantControl({ sp, qty, isOutOfStock, mode, onAddToCart, onUpdateQuantity, onSelect }: ControlProps) {
  if (mode === "cart" && qty > 0) {
    return (
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onUpdateQuantity(sp.id, qty - 1)} hitSlop={HIT_SLOP} accessibilityLabel="Remove one">
          <Ionicons name="remove" size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.stepText}>{qty}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onAddToCart(sp)} hitSlop={HIT_SLOP} accessibilityLabel="Add one more">
          <Ionicons name="add" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }
  const label = isOutOfStock ? "N/A" : mode === "subscribe" ? "SUBSCRIBE" : "ADD";
  return (
    <TouchableOpacity
      style={[styles.addBtn, isOutOfStock && styles.addBtnDisabled]}
      onPress={() => (mode === "subscribe" ? onSelect?.(sp) : onAddToCart(sp))}
      disabled={isOutOfStock}
      hitSlop={HIT_SLOP}
      activeOpacity={0.8}
    >
      <Text style={[styles.addText, isOutOfStock && styles.addTextDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

function VariantRow({ sp, qty, isMember, ...controlProps }: Omit<ControlProps, "isOutOfStock"> & { isMember?: boolean }) {
  const { shown, struck, plusHint, discountLabel } = getPrices(sp, isMember);
  const available = sp.availableStock ?? (sp.stock - (sp.reservedStock ?? 0));
  const isOutOfStock = available <= 0;
  const image = sp.variant.imageUrl || sp.product.imageUrl;
  return (
    <View style={[styles.row, isOutOfStock && styles.rowDisabled]}>
      <View style={styles.thumb}>
        {image ? <Image source={{ uri: image }} style={styles.thumbImage} resizeMode="contain" /> : null}
      </View>
      <View style={styles.info}>
        <Text style={styles.variantName}>{sp.variant.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{"\u20B9"}{shown.toFixed(0)}</Text>
          {struck != null && <Text style={styles.mrp}>{"\u20B9"}{struck.toFixed(0)}</Text>}
          {discountLabel && (
            <View style={styles.discountPill}>
              <Text style={styles.discountText}>{discountLabel}</Text>
            </View>
          )}
        </View>
        {plusHint != null && <Text style={styles.plusHint}>{"\u20B9"}{plusHint.toFixed(0)} with Plus</Text>}
        {isOutOfStock && <Text style={styles.outOfStock}>Out of stock</Text>}
      </View>
      <VariantControl sp={sp} qty={qty} isOutOfStock={isOutOfStock} {...controlProps} />
    </View>
  );
}

// Shown once any size is in the cart: the two natural next steps, keep browsing or check out
function SheetFooter({ count, total, onDone }: { count: number; total: number; onDone: () => void }) {
  return (
    <View style={styles.footer}>
      <View style={styles.footerSummary}>
        <Text style={styles.footerCount}>{count} {count === 1 ? "item" : "items"}</Text>
        <Text style={styles.footerTotal}>{"\u20B9"}{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Text>
      </View>
      <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.8}>
        <Text style={styles.doneText}>Done</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.viewCartBtn}
        onPress={() => { onDone(); router.push("/(tabs)/cart"); }}
        activeOpacity={0.85}
      >
        <Text style={styles.viewCartText}>View cart</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export function VariantBottomSheet({
  visible, onClose, variants, onAddToCart, onUpdateQuantity, cartQuantityMap, isMember, mode = "cart", onSelect,
}: VariantBottomSheetProps) {
  if (!visible || variants.length === 0) return null;

  const inCart = variants.map((sp) => ({ qty: cartQuantityMap.get(sp.id) ?? 0, price: getPrices(sp, isMember).shown }));
  const count = inCart.reduce((n, v) => n + v.qty, 0);
  const total = inCart.reduce((sum, v) => sum + v.qty * v.price, 0);

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.sheet}>
        <View style={styles.handleBar} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={2}>{variants[0].product.name}</Text>
            <Text style={styles.subtitle}>
              {mode === "subscribe" ? "Choose a size to subscribe" : `${variants.length} sizes available`}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView bounces={false} contentContainerStyle={styles.list}>
          {variants.map((sp) => (
            <VariantRow
              key={sp.id} sp={sp} qty={cartQuantityMap.get(sp.id) ?? 0} isMember={isMember} mode={mode}
              onAddToCart={onAddToCart} onUpdateQuantity={onUpdateQuantity} onSelect={onSelect}
            />
          ))}
        </ScrollView>
        {mode === "cart" && count > 0 && <SheetFooter count={count} total={total} onDone={onClose} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.45)" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: spacing.md, paddingBottom: spacing.xl, maxHeight: SHEET_MAX,
  },
  handleBar: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: "center", marginTop: spacing.sm, marginBottom: 12,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  headerText: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 22, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  list: { gap: 10 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, borderColor: "#eef2f6", padding: 10,
  },
  rowDisabled: { opacity: 0.6 },
  thumb: {
    width: 60, height: 60, borderRadius: 10, backgroundColor: "#f8fafc",
    padding: 4, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  // Multiply blends white product-photo backgrounds into the tile, as on the product cards
  thumbImage: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  info: { flex: 1 },
  variantName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" },
  price: { fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.text },
  mrp: { fontFamily: fonts.medium, fontSize: 12, color: "#94a3b8", textDecorationLine: "line-through" },
  discountPill: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  discountText: { fontFamily: fonts.extrabold, fontSize: 10, color: colors.accentText },
  plusHint: { fontFamily: fonts.bold, fontSize: 11.5, color: "#b45309", marginTop: 2 },
  outOfStock: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    minWidth: CONTROL_WIDTH, paddingHorizontal: 10, height: 34, borderRadius: 9,
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  addBtnDisabled: { borderColor: colors.border, backgroundColor: colors.surface },
  addText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.primary, letterSpacing: 0.3 },
  addTextDisabled: { color: "#94a3b8" },
  stepper: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    width: CONTROL_WIDTH, height: 34, borderRadius: 9, backgroundColor: colors.primary,
  },
  stepBtn: { width: 24, height: 34, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: fonts.extrabold, fontSize: 13.5, color: "#fff", textAlign: "center" },
  footer: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderTopWidth: 1, borderTopColor: "#eef2f6", marginTop: 14, paddingTop: 14,
  },
  footerSummary: { flex: 1 },
  footerCount: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  footerTotal: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
  doneBtn: {
    height: 46, paddingHorizontal: 18, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  doneText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  viewCartBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    height: 46, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.primary,
  },
  viewCartText: { fontFamily: fonts.bold, fontSize: 15, color: "#fff" },
});
