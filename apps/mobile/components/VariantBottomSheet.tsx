import { View, Text, Image, TouchableOpacity, TouchableWithoutFeedback, ScrollView, StyleSheet, Dimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../constants/theme";
import type { StoreProduct } from "../lib/types";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const SHEET_MAX = SCREEN_HEIGHT * 0.7;
const CONTROL_WIDTH = 72;
const CONTROL_HEIGHT = 34;
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - CARD_GAP) / 2;
// Square image tile inside the card's 8pt padding and 1pt border
const TILE = CARD_WIDTH - 16 - 2;
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

const perAmount = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

// Price per standard unit, e.g. "₹56.5/100 g" for a 200 g pack; null when it would just repeat the price
function unitPriceLabel(sp: StoreProduct, price: number): string | null {
  const value = Number(sp.variant.unitValue);
  if (!value) return null;
  // Keyed by the API's display labels (formatUnitType), not the enum names
  const [amount, label] = ({
    g: value < 1000 ? [value / 100, "100 g"] : [value / 1000, "kg"],
    kg: value < 1 ? [value * 10, "100 g"] : [value, "kg"],
    ml: value < 1000 ? [value / 100, "100 ml"] : [value / 1000, "L"],
    L: value < 1 ? [value * 10, "100 ml"] : [value, "L"],
    pcs: [value, "pc"],
    pack: [value, "pack"],
    doz: [value * 12, "pc"],
  } as Record<string, [number, string]>)[sp.variant.unitType] ?? [1, ""];
  return amount === 1 ? null : `\u20B9${perAmount(price / amount)}/${label}`;
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

// One size as a card: image with the ADD control straddling its corner, then size, price and per-unit price
function VariantCard({ sp, qty, isMember, ...controlProps }: Omit<ControlProps, "isOutOfStock"> & { isMember?: boolean }) {
  const { shown, struck, plusHint, discountLabel } = getPrices(sp, isMember);
  const available = sp.availableStock ?? (sp.stock - (sp.reservedStock ?? 0));
  const isOutOfStock = available <= 0;
  const image = sp.variant.imageUrl || sp.product.imageUrl;
  const unitPrice = unitPriceLabel(sp, shown);
  return (
    <View style={[styles.card, isOutOfStock && styles.cardDisabled]}>
      <View style={styles.tile}>
        {image ? <Image source={{ uri: image }} style={styles.tileImage} resizeMode="contain" /> : null}
      </View>
      <View style={styles.controlWrap}>
        <VariantControl sp={sp} qty={qty} isOutOfStock={isOutOfStock} {...controlProps} />
      </View>
      <Text style={styles.variantName} numberOfLines={1}>{sp.variant.name}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{"\u20B9"}{shown.toFixed(0)}</Text>
        {struck != null && <Text style={styles.mrp}>{"\u20B9"}{struck.toFixed(0)}</Text>}
      </View>
      {discountLabel && <Text style={styles.discount}>{discountLabel}</Text>}
      {unitPrice && <Text style={styles.unitPrice}>{unitPrice}</Text>}
      {plusHint != null && <Text style={styles.plusHint}>{"\u20B9"}{plusHint.toFixed(0)} with Plus</Text>}
      {isOutOfStock && <Text style={styles.outOfStock}>Out of stock</Text>}
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
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={2}>{variants[0].product.name}</Text>
        {mode === "subscribe" && <Text style={styles.subtitle}>Choose a size to subscribe</Text>}
        <ScrollView bounces={false} contentContainerStyle={styles.grid}>
          {variants.map((sp) => (
            <VariantCard
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
    paddingHorizontal: spacing.md, paddingTop: 18, paddingBottom: spacing.xl, maxHeight: SHEET_MAX,
  },
  // Floats above the sheet, Blinkit-style
  closeBtn: {
    position: "absolute", top: -58, alignSelf: "center",
    width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(15,23,42,0.85)",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 23, color: colors.text, marginBottom: 14 },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: -10, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP, paddingBottom: 4 },
  card: {
    width: CARD_WIDTH, borderRadius: 14, borderWidth: 1, borderColor: "#eef2f6", padding: 8, paddingBottom: 12,
  },
  cardDisabled: { opacity: 0.6 },
  tile: {
    width: TILE, height: TILE, borderRadius: 10, backgroundColor: "#f8fafc",
    padding: 8, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  // Multiply blends white product-photo backgrounds into the tile, as on the product cards
  tileImage: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  controlWrap: { position: "absolute", top: 8 + TILE - CONTROL_HEIGHT / 2, right: 12 },
  variantName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, marginTop: CONTROL_HEIGHT / 2 + 6 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 },
  price: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
  mrp: { fontFamily: fonts.medium, fontSize: 12, color: "#94a3b8", textDecorationLine: "line-through" },
  discount: { fontFamily: fonts.bold, fontSize: 11.5, color: "#2563eb", marginTop: 1 },
  unitPrice: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  plusHint: { fontFamily: fonts.bold, fontSize: 11.5, color: "#b45309", marginTop: 2 },
  outOfStock: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    minWidth: CONTROL_WIDTH, paddingHorizontal: 10, height: CONTROL_HEIGHT, borderRadius: 9,
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#fff",
    shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    alignItems: "center", justifyContent: "center",
  },
  addBtnDisabled: { borderColor: colors.border, backgroundColor: colors.surface },
  addText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.primary, letterSpacing: 0.3 },
  addTextDisabled: { color: "#94a3b8" },
  stepper: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    width: CONTROL_WIDTH, height: CONTROL_HEIGHT, borderRadius: 9, backgroundColor: colors.primary,
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
