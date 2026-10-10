import { useRef } from "react";
import { View, Text, TouchableOpacity, Pressable, Image, StyleSheet, Dimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../constants/theme";
import { useLanguage } from "../lib/language-context";
import { FoodTypeMark } from "./FoodTypeMark";
import type { StoreProduct } from "../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COMPACT_H_PADDING = spacing.md;
export const COMPACT_GAP = 8;
export const COMPACT_CARD_WIDTH = Math.floor((SCREEN_WIDTH - 2 * COMPACT_H_PADDING - 2 * COMPACT_GAP) / 3);
const CONTROL_WIDTH = 56;
const CONTROL_HEIGHT = 30;
const HIT_SLOP = { top: 7, bottom: 7, left: 4, right: 4 };
// Card border (1px each side) plus the 6px image margins
const TILE_SIZE = COMPACT_CARD_WIDTH - 2 - 12;

export interface CompactProductCardProps {
  item: StoreProduct;
  onAddToCart: (sp: StoreProduct) => void;
  onUpdateQuantity: (storeProductId: string, quantity: number) => void;
  quantity?: number;
  storeId?: string;
  variantCount?: number;
  onShowVariants?: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string) => void;
  isMember?: boolean;
}

function discountLine(item: StoreProduct): string | null {
  const p = item.pricing;
  if (!p?.discountActive) return null;
  return p.discountType === "PERCENTAGE" ? `${p.discountValue}% OFF` : `₹${p.discountValue} OFF`;
}

function resolvePrices(item: StoreProduct, isMember?: boolean) {
  const active = !!item.pricing?.discountActive;
  const price = active ? item.pricing!.effectivePrice : Number(item.price);
  const memberPrice = item.pricing?.memberPrice;
  const memberCheaper = !!isMember && memberPrice != null && memberPrice < price;
  return {
    shown: memberCheaper ? memberPrice! : price,
    struck: memberCheaper ? price : active ? item.pricing!.originalPrice : null,
  };
}

function CompactControl({ item, quantity, variantCount, outOfStock, onAddToCart, onUpdateQuantity, onShowVariants }: Required<Pick<CompactProductCardProps, "quantity" | "variantCount">> & Pick<CompactProductCardProps, "item" | "onAddToCart" | "onUpdateQuantity" | "onShowVariants"> & { outOfStock: boolean }) {
  const hasOptions = variantCount > 1;
  const increment = hasOptions ? onShowVariants : () => onAddToCart(item);
  const decrement = hasOptions ? onShowVariants : () => onUpdateQuantity(item.id, quantity - 1);
  if (quantity > 0) {
    return (
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={decrement} hitSlop={HIT_SLOP} accessibilityLabel="Remove one">
          <Ionicons name="remove" size={14} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.stepText}>{quantity}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={increment} hitSlop={HIT_SLOP} accessibilityLabel="Add one more">
          <Ionicons name="add" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.addBtn, outOfStock && styles.addBtnDisabled]}
      onPress={increment}
      disabled={outOfStock}
      activeOpacity={0.8}
      hitSlop={HIT_SLOP}
      accessibilityLabel={hasOptions ? "Add, choose a size" : "Add to cart"}
    >
      <Text style={[styles.addText, outOfStock && styles.addTextDisabled]}>ADD</Text>
    </TouchableOpacity>
  );
}

function CompactImage({ item, outOfStock, wished, onHeart }: { item: StoreProduct; outOfStock: boolean; wished?: boolean; onHeart?: () => void }) {
  const uri = item.product.imageUrl || item.variant.imageUrl;
  return (
    <View style={styles.imageContainer}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      ) : (
        <Text style={styles.noImageLetter}>{item.product.name.charAt(0)}</Text>
      )}
      {item.product.foodType && <FoodTypeMark foodType={item.product.foodType} />}
      {outOfStock && (
        <View style={styles.oos}><Text style={styles.oosLabel}>Out of stock</Text></View>
      )}
      {onHeart && (
        <Pressable style={styles.heart} onPress={onHeart} hitSlop={8} accessibilityLabel="Toggle wishlist">
          <Ionicons name={wished ? "heart" : "heart-outline"} size={14} color={wished ? "#ef4444" : "#94a3b8"} />
        </Pressable>
      )}
    </View>
  );
}

function CompactDetails({ item, variantCount, isMember }: { item: StoreProduct; variantCount: number; isMember?: boolean }) {
  const { getLocalizedName } = useLanguage();
  const { shown, struck } = resolvePrices(item, isMember);
  const discount = discountLine(item);
  const rated = (item.product.reviewCount ?? 0) > 0 && (item.product.averageRating ?? 0) > 0;
  return (
    <>
      <View style={styles.unitRow}>
        <Text style={styles.unit} numberOfLines={1}>{item.variant.name}</Text>
        {variantCount > 1 && <Text style={styles.options}>{variantCount} options</Text>}
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.price} numberOfLines={1}>{"₹"}{shown.toFixed(0)}</Text>
        {struck != null && <Text style={styles.mrp}>{"₹"}{struck.toFixed(0)}</Text>}
      </View>
      {discount && <Text style={styles.discount}>{discount}</Text>}
      <Text style={styles.name} numberOfLines={3}>{getLocalizedName(item.product)}</Text>
      {rated && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={10} color="#f59e0b" />
          <Text style={styles.ratingText}>{item.product.averageRating!.toFixed(1)}</Text>
          <Text style={styles.ratingCount}>({item.product.reviewCount})</Text>
        </View>
      )}
    </>
  );
}

export function CompactProductCard(props: CompactProductCardProps) {
  const { item, storeId, quantity = 0, variantCount = 1, onToggleWishlist, isWishlisted } = props;
  const available = item.availableStock ?? (item.stock - (item.reservedStock ?? 0));
  const heartTapped = useRef(false);

  const openProduct = () => {
    if (heartTapped.current) { heartTapped.current = false; return; }
    const params: Record<string, string> = { id: item.product.id };
    if (storeId) params.storeId = storeId;
    router.push({ pathname: "/product/[id]", params });
  };

  return (
    <TouchableOpacity style={styles.card} onPress={openProduct} activeOpacity={0.8}>
      <CompactImage
        item={item}
        outOfStock={available <= 0}
        wished={isWishlisted}
        onHeart={onToggleWishlist && (() => { heartTapped.current = true; onToggleWishlist(item.product.id); })}
      />
      <View style={styles.controlOverlay}>
        <CompactControl
          item={item} quantity={quantity} variantCount={variantCount} outOfStock={available <= 0}
          onAddToCart={props.onAddToCart} onUpdateQuantity={props.onUpdateQuantity} onShowVariants={props.onShowVariants}
        />
      </View>
      <View style={styles.content}>
        <CompactDetails item={item} variantCount={variantCount} isMember={props.isMember} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: COMPACT_CARD_WIDTH, marginBottom: COMPACT_GAP + 4, backgroundColor: "#fff",
    borderRadius: 12, borderWidth: 1, borderColor: "#eef2f6", overflow: "hidden",
  },
  imageContainer: {
    width: TILE_SIZE, height: TILE_SIZE, margin: 6, borderRadius: 10, backgroundColor: "#f8fafc",
    padding: 4, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  image: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  noImageLetter: { fontFamily: fonts.bold, fontSize: 22, color: "#cbd5e1" },
  oos: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.8)", justifyContent: "center", alignItems: "center" },
  oosLabel: { fontFamily: fonts.bold, fontSize: 10, color: colors.textSecondary },
  heart: {
    position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#fff", justifyContent: "center", alignItems: "center", zIndex: 2,
  },
  controlOverlay: { position: "absolute", right: 6, top: 6 + TILE_SIZE - CONTROL_HEIGHT / 2, zIndex: 3 },
  content: { paddingHorizontal: 8, paddingTop: CONTROL_HEIGHT / 2 + 2, paddingBottom: 8 },
  unitRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, minHeight: 14 },
  unit: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  options: { fontFamily: fonts.medium, fontSize: 9.5, color: colors.textSecondary },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 },
  price: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text },
  mrp: { fontFamily: fonts.medium, fontSize: 11, color: "#94a3b8", textDecorationLine: "line-through" },
  discount: { fontFamily: fonts.bold, fontSize: 10.5, color: "#2563eb", marginTop: 1 },
  name: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 15, color: colors.text, marginTop: 3 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 3 },
  ratingText: { fontFamily: fonts.semibold, fontSize: 10, color: "#92400e" },
  ratingCount: { fontFamily: fonts.regular, fontSize: 9.5, color: "#94a3b8" },
  addBtn: {
    width: CONTROL_WIDTH, height: CONTROL_HEIGHT, borderRadius: 8, borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  addBtnDisabled: { borderColor: colors.border, backgroundColor: colors.surface },
  addText: { fontFamily: fonts.extrabold, fontSize: 12, color: colors.primary, letterSpacing: 0.3 },
  addTextDisabled: { color: "#94a3b8" },
  stepper: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    width: CONTROL_WIDTH, height: CONTROL_HEIGHT, borderRadius: 8, backgroundColor: colors.primary,
  },
  stepBtn: { width: 20, height: CONTROL_HEIGHT, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: fonts.extrabold, fontSize: 12, color: "#fff", textAlign: "center" },
});
