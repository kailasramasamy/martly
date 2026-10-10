import { useRef } from "react";
import { View, Text, TouchableOpacity, Pressable, Image, StyleSheet, Dimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../constants/theme";
import type { StoreProduct } from "../lib/types";
import { useLanguage } from "../lib/language-context";
import { FoodTypeMark } from "./FoodTypeMark";
import { CompactProductCard } from "./CompactProductCard";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_GAP = 10;
// ~3 cards per screen
export const FEATURED_CARD_WIDTH = Math.floor((SCREEN_WIDTH - 16) / 3.1 - CARD_GAP);
// Two-column grids (category, search, store, wishlist)
export const GRID_GAP = 12;
export const GRID_H_PADDING = spacing.md;
export const GRID_CARD_WIDTH = (SCREEN_WIDTH - GRID_H_PADDING * 2 - GRID_GAP) / 2;
// Square image tile flush with the card edges: card width minus its 1px borders
export const imageTileSize = (cardWidth: number) => cardWidth - 2;
const CONTROL_WIDTH = 54;
const CONTROL_HEIGHT = 32;
// Extends the 32pt controls to a 44pt touch target
const HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

interface FeaturedProductCardProps {
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
  // Grid usage: explicit card width (rails default to FEATURED_CARD_WIDTH with a right margin)
  width?: number;
  // 3-column search layout: smaller card, "N options" instead of the sizes row
  compact?: boolean;
}

function getDiscountLabel(item: StoreProduct): string | null {
  if (!item.pricing?.discountActive) return null;
  return item.pricing.discountType === "PERCENTAGE"
    ? `${item.pricing.discountValue}% OFF`
    : `\u20B9${item.pricing.discountValue} OFF`;
}

function CardImage({ item, size, isOutOfStock, isWishlisted, onHeart }: {
  item: StoreProduct; size: number; isOutOfStock: boolean; isWishlisted?: boolean; onHeart?: () => void;
}) {
  const productImage = item.product.imageUrl || item.variant.imageUrl;
  return (
    <View style={[styles.imageContainer, { width: size, height: size }]}>
      {productImage ? (
        <Image source={{ uri: productImage }} style={styles.image} resizeMode="contain" />
      ) : (
        <Text style={styles.noImageLetter}>{item.product.name.charAt(0)}</Text>
      )}
      {item.product.foodType && <FoodTypeMark foodType={item.product.foodType} />}
      {isOutOfStock && (
        <View style={styles.oosOverlay}>
          <Text style={styles.oosLabel}>Out of stock</Text>
        </View>
      )}
      {onHeart && (
        <Pressable style={styles.heartBtn} onPress={onHeart} hitSlop={8} accessibilityLabel="Toggle wishlist">
          <Ionicons name={isWishlisted ? "heart" : "heart-outline"} size={15} color={isWishlisted ? "#ef4444" : "#94a3b8"} />
        </Pressable>
      )}
    </View>
  );
}

function PriceBlock({ item, isMember }: { item: StoreProduct; isMember?: boolean }) {
  const hasDiscount = item.pricing?.discountActive;
  const displayPrice = hasDiscount ? item.pricing!.effectivePrice : Number(item.price);
  const originalPrice = hasDiscount ? item.pricing!.originalPrice : null;
  const memberPrice = item.pricing?.memberPrice;
  const memberCheaper = memberPrice != null && memberPrice < displayPrice;
  const shown = isMember && memberCheaper ? memberPrice : displayPrice;
  const struck = isMember && memberCheaper ? displayPrice : originalPrice;
  const discountLabel = getDiscountLabel(item);
  return (
    <View>
      <View style={styles.priceRow}>
        <Text style={styles.price} numberOfLines={1}>{"\u20B9"}{shown.toFixed(0)}</Text>
        {struck != null && <Text style={styles.mrp}>{"\u20B9"}{struck.toFixed(0)}</Text>}
      </View>
      {discountLabel && <Text style={styles.discount}>{discountLabel}</Text>}
      {!isMember && memberCheaper && (
        <Text style={styles.memberHint}>{"\u20B9"}{memberPrice!.toFixed(0)} with Plus</Text>
      )}
    </View>
  );
}

interface AddControlProps {
  item: StoreProduct;
  quantity: number;
  variantCount: number;
  isOutOfStock: boolean;
  onAddToCart: (sp: StoreProduct) => void;
  onUpdateQuantity: (storeProductId: string, quantity: number) => void;
  onShowVariants?: () => void;
}

// Same footprint for ADD and the stepper so the card doesn't shift when an item is added.
// Multi-variant products open the size picker from every control, since the size to change is ambiguous.
function AddControl({ item, quantity, variantCount, isOutOfStock, onAddToCart, onUpdateQuantity, onShowVariants }: AddControlProps) {
  const hasOptions = variantCount > 1;
  const increment = hasOptions ? onShowVariants : () => onAddToCart(item);
  const decrement = hasOptions ? onShowVariants : () => onUpdateQuantity(item.id, quantity - 1);

  if (quantity > 0) {
    return (
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={decrement} hitSlop={HIT_SLOP} accessibilityLabel="Remove one">
          <Ionicons name="remove" size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.stepText}>{quantity}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={increment} hitSlop={HIT_SLOP} accessibilityLabel="Add one more">
          <Ionicons name="add" size={15} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.addBtn, isOutOfStock && styles.addBtnDisabled]}
      onPress={increment}
      disabled={isOutOfStock}
      activeOpacity={0.8}
      hitSlop={HIT_SLOP}
      accessibilityLabel={hasOptions ? "Add, choose a size" : "Add to cart"}
    >
      <Text style={[styles.addBtnText, isOutOfStock && styles.addBtnTextDisabled]}>ADD</Text>
      {hasOptions && !isOutOfStock && <Text style={styles.optionsText}>{variantCount} options</Text>}
    </TouchableOpacity>
  );
}

// Default pack size on the left, ADD on the right — sits directly under the image, Blinkit-style
function UnitBar({ item, variantCount, onShowVariants, children }: {
  item: StoreProduct; variantCount: number; onShowVariants?: () => void; children: React.ReactNode;
}) {
  const unitLabel = item.variant.name;
  return (
    <View style={styles.unitBar}>
      {variantCount > 1 ? (
        <Pressable style={styles.unitRow} onPress={onShowVariants} hitSlop={6} accessibilityLabel={`${unitLabel}, ${variantCount} sizes`}>
          <Text style={styles.unit} numberOfLines={1}>{unitLabel}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.unit, styles.unitRow]} numberOfLines={1}>{unitLabel}</Text>
      )}
      {children}
    </View>
  );
}

function CardDetails({ item, lowStock }: { item: StoreProduct; lowStock: number | null }) {
  const { getLocalizedName, getLocalizedSubtitle } = useLanguage();
  const subtitle = getLocalizedSubtitle(item.product);
  return (
    <>
      <Text style={styles.name} numberOfLines={3}>{getLocalizedName(item.product)}</Text>
      {subtitle && <Text style={styles.nameSubtitle} numberOfLines={1}>{subtitle}</Text>}
      {(item.product.averageRating ?? 0) > 0 && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={10} color="#f59e0b" />
          <Text style={styles.ratingText}>{item.product.averageRating!.toFixed(1)}</Text>
          {(item.product.reviewCount ?? 0) > 0 && <Text style={styles.ratingCount}>({item.product.reviewCount})</Text>}
        </View>
      )}
      {lowStock != null && <Text style={styles.lowStock}>Only {lowStock} left</Text>}
    </>
  );
}

function StandardCard({ item, onAddToCart, onUpdateQuantity, quantity = 0, storeId, variantCount = 1, onShowVariants, isWishlisted, onToggleWishlist, isMember, width }: FeaturedProductCardProps) {
  const cardWidth = width ?? FEATURED_CARD_WIDTH;
  const tile = imageTileSize(cardWidth);
  const available = item.availableStock ?? (item.stock - (item.reservedStock ?? 0));
  const isOutOfStock = available <= 0;
  const isLowStock = !isOutOfStock && available <= 5;
  const heartTapped = useRef(false);

  const openProduct = () => {
    if (heartTapped.current) { heartTapped.current = false; return; }
    const params: Record<string, string> = { id: item.product.id };
    if (storeId) params.storeId = storeId;
    router.push({ pathname: "/product/[id]", params });
  };

  return (
    <TouchableOpacity style={[styles.card, { width: cardWidth }, width != null && styles.gridCard]} onPress={openProduct} activeOpacity={0.8}>
      <View style={styles.tileBlock}>
        <CardImage
          item={item}
          size={tile}
          isOutOfStock={isOutOfStock}
          isWishlisted={isWishlisted}
          onHeart={onToggleWishlist && (() => { heartTapped.current = true; onToggleWishlist(item.product.id); })}
        />
        <UnitBar item={item} variantCount={variantCount} onShowVariants={onShowVariants}>
          <AddControl
            item={item} quantity={quantity} variantCount={variantCount} isOutOfStock={isOutOfStock}
            onAddToCart={onAddToCart} onUpdateQuantity={onUpdateQuantity} onShowVariants={onShowVariants}
          />
        </UnitBar>
      </View>
      <View style={styles.content}>
        <PriceBlock item={item} isMember={isMember} />
        <CardDetails item={item} lowStock={isLowStock ? available : null} />
      </View>
    </TouchableOpacity>
  );
}

export function FeaturedProductCard(props: FeaturedProductCardProps) {
  return props.compact ? <CompactProductCard {...props} /> : <StandardCard {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eef2f6",
    marginRight: CARD_GAP,
    overflow: "hidden",
  },
  gridCard: { marginRight: 0, marginBottom: GRID_GAP },
  // Image + unit bar run edge to edge; the card's rounded corners clip the image
  tileBlock: { borderBottomWidth: 1, borderBottomColor: "#eef2f6" },
  imageContainer: {
    backgroundColor: "#f8fafc",
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // Multiply blends white product-photo backgrounds into the tile so every image looks uniform
  image: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  noImageLetter: { fontFamily: fonts.bold, fontSize: 24, color: "#cbd5e1" },
  heartBtn: {
    position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#fff", justifyContent: "center", alignItems: "center", zIndex: 2,
    shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  oosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.8)", justifyContent: "center", alignItems: "center",
  },
  oosLabel: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textSecondary },
  unitBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4,
    paddingLeft: 9, paddingRight: 6, paddingVertical: 5,
    borderTopWidth: 1, borderTopColor: "#eef2f6", backgroundColor: "#fff",
  },
  content: { paddingHorizontal: 9, paddingTop: 6, paddingBottom: 10 },
  name: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 16, minHeight: 32, color: colors.text, marginTop: 3 },
  nameSubtitle: { fontFamily: fonts.regular, fontSize: 10, color: "#94a3b8" },
  unitRow: { flexShrink: 1 },
  unit: { fontFamily: fonts.bold, fontSize: 12, color: colors.text, flexShrink: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 3 },
  ratingText: { fontFamily: fonts.semibold, fontSize: 10, color: "#92400e" },
  ratingCount: { fontFamily: fonts.regular, fontSize: 9.5, color: "#94a3b8" },
  lowStock: { fontFamily: fonts.semibold, fontSize: 10, color: colors.warning, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  price: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  mrp: { fontFamily: fonts.medium, fontSize: 11, color: "#94a3b8", textDecorationLine: "line-through" },
  discount: { fontFamily: fonts.bold, fontSize: 11, color: "#2563eb", marginTop: 1 },
  memberHint: { fontFamily: fonts.bold, fontSize: 9.5, color: "#b45309", marginTop: 1 },
  addBtn: {
    width: CONTROL_WIDTH, height: CONTROL_HEIGHT, borderRadius: 9,
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#fff",
    shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    alignItems: "center", justifyContent: "center",
  },
  addBtnDisabled: { borderColor: colors.border, backgroundColor: colors.surface },
  addBtnText: { fontFamily: fonts.extrabold, fontSize: 13, lineHeight: 15, color: colors.primary, letterSpacing: 0.3 },
  optionsText: { fontFamily: fonts.semibold, fontSize: 8.5, lineHeight: 10, color: colors.textSecondary },
  addBtnTextDisabled: { color: "#94a3b8" },
  stepper: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    width: CONTROL_WIDTH, height: CONTROL_HEIGHT, borderRadius: 9, backgroundColor: colors.primary,
  },
  stepBtn: { width: 20, height: 32, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: fonts.extrabold, fontSize: 13, color: "#fff", textAlign: "center" },
});
