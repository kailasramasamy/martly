import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Pressable, Image, StyleSheet, Dimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../constants/theme";
import type { StoreProduct } from "../lib/types";
import { useLanguage } from "../lib/language-context";
import { FoodTypeMark } from "./FoodTypeMark";
import { BestsellerBadge, UnitPrice } from "./ProductBadges";
import { CompactProductCard } from "./CompactProductCard";
import { bySize, packSaving } from "../lib/pack-sizes";
import { SizePager, sizeImage } from "./PackSizes";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_GAP = 10;
// ~3 cards per screen
export const FEATURED_CARD_WIDTH = Math.floor((SCREEN_WIDTH - 16) / 3.1 - CARD_GAP);
// Two-column grids (category, search, store, wishlist)
export const GRID_GAP = 12;
export const GRID_H_PADDING = spacing.md;
export const GRID_CARD_WIDTH = (SCREEN_WIDTH - GRID_H_PADDING * 2 - GRID_GAP) / 2;
// The photo is a square tile as wide as the card
export const imageTileSize = (cardWidth: number) => cardWidth;
// Once something's in the cart the stepper widens, so − and + are easy to hit with a thumb, as far as the photo allows
const STEPPER_WIDTH = 84;
const CONTROL_INSET = 6;
// The photo's padding plus its 1px border
const TILE_INSET = 7;
const stepperWidth = (cardWidth: number) => Math.min(STEPPER_WIDTH, cardWidth - 2 * CONTROL_INSET);
const CONTROL_HEIGHT = 36;
const ADD_WIDTH = 66;
// Extends the 32pt controls to a 44pt touch target
const HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };
const STEP_HIT_SLOP = { top: 8, bottom: 8, left: 6, right: 6 };

interface FeaturedProductCardProps {
  item: StoreProduct;
  onAddToCart: (sp: StoreProduct) => void;
  onUpdateQuantity: (storeProductId: string, quantity: number) => void;
  quantity?: number;
  storeId?: string;
  variantCount?: number;
  onShowVariants?: () => void;
  // All of the product's sizes and each one's cart quantity: the standard card shows them as size chips
  variants?: StoreProduct[];
  quantityOf?: (storeProductId: string) => number;
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string) => void;
  isMember?: boolean;
  // Grid usage: explicit card width (rails default to FEATURED_CARD_WIDTH with a right margin)
  width?: number;
  // 3-column search layout: smaller card, "N options" instead of the sizes row
  compact?: boolean;
  // Called as the product page opens (search result tracking)
  onOpen?: () => void;
}

// A square photo tile with ADD in its bottom-right corner, Zepto-style
function CardImage({ item, primaryId, size, isOutOfStock, isWishlisted, onHeart, pager, control }: {
  item: StoreProduct; primaryId: string; size: number; isOutOfStock: boolean; isWishlisted?: boolean; onHeart?: () => void;
  pager?: React.ReactNode; control: React.ReactNode;
}) {
  const productImage = sizeImage(item, primaryId);
  return (
    <View style={[styles.imageContainer, { width: size, height: size }]}>
      {pager ?? (productImage ? (
        <Image source={{ uri: productImage }} style={styles.image} resizeMode="contain" />
      ) : (
        <Text style={styles.noImageLetter}>{item.product.name.charAt(0)}</Text>
      ))}
      {item.product.foodType && <FoodTypeMark foodType={item.product.foodType} />}
      {item.product.isBestseller && <BestsellerBadge />}
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
      <View style={styles.controlCorner}>{control}</View>
    </View>
  );
}

function PriceBlock({ item, isMember, saving }: { item: StoreProduct; isMember?: boolean; saving?: string | null }) {
  const hasDiscount = item.pricing?.discountActive;
  const displayPrice = hasDiscount ? item.pricing!.effectivePrice : Number(item.price);
  const originalPrice = hasDiscount ? item.pricing!.originalPrice : null;
  const memberPrice = item.pricing?.memberPrice;
  const memberCheaper = memberPrice != null && memberPrice < displayPrice;
  const shown = isMember && memberCheaper ? memberPrice : displayPrice;
  const struck = isMember && memberCheaper ? displayPrice : originalPrice;
  const offPercent = struck != null && struck > shown ? Math.round(((struck - shown) / struck) * 100) : 0;
  return (
    <View>
      <View style={styles.priceRow}>
        <Text style={styles.price} numberOfLines={1}>{"\u20B9"}{shown.toFixed(0)}</Text>
        {offPercent > 0 && <Text style={styles.mrp}>{"\u20B9"}{struck!.toFixed(0)}</Text>}
      </View>
      <UnitPrice price={shown} variant={item.variant} />
      {offPercent > 0 && <View style={styles.offTag}><Text style={styles.off}>{offPercent}% OFF</Text></View>}
      {saving && <Text style={styles.saving}>{saving}</Text>}
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
  cardWidth: number;
}

// ADD (with "N options" when there are several sizes); once in the cart a wider stepper takes its place, for thumbs.
// With several sizes every control opens the size sheet, since which size to change is ambiguous.
function AddControl({ item, quantity, variantCount, isOutOfStock, onAddToCart, onUpdateQuantity, onShowVariants, cardWidth }: AddControlProps) {
  const hasOptions = variantCount > 1 && onShowVariants != null;
  const increment = hasOptions ? onShowVariants : () => onAddToCart(item);
  const decrement = hasOptions ? onShowVariants : () => onUpdateQuantity(item.id, quantity - 1);

  if (quantity > 0) {
    return (
      <View style={[styles.stepper, { width: stepperWidth(cardWidth) }]}>
        <TouchableOpacity style={styles.stepBtn} onPress={decrement} hitSlop={STEP_HIT_SLOP} accessibilityLabel="Remove one">
          <Ionicons name="remove" size={17} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.stepText}>{quantity}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={increment} hitSlop={STEP_HIT_SLOP} accessibilityLabel="Add one more">
          <Ionicons name="add" size={17} color="#fff" />
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
      accessibilityLabel={hasOptions ? `Add, choose from ${variantCount} sizes` : "Add to cart"}
    >
      <Text style={[styles.addBtnText, isOutOfStock && styles.addBtnTextDisabled]}>ADD</Text>
      {hasOptions && !isOutOfStock && <Text style={styles.optionsText}>{variantCount} options</Text>}
    </TouchableOpacity>
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

/** Opens the product page on a card tap, unless the tap was on the wishlist heart */
function useOpenProduct(productId: string, storeId: string | undefined, onOpen?: () => void) {
  const heartTapped = useRef(false);
  const openProduct = () => {
    if (heartTapped.current) { heartTapped.current = false; return; }
    const params: Record<string, string> = { id: productId };
    if (storeId) params.storeId = storeId;
    onOpen?.();
    router.push({ pathname: "/product/[id]", params });
  };
  return { openProduct, heartTapped };
}

/** What's left to sell of a size: out of stock at 0, low at 5 or fewer */
function stockState(item: StoreProduct) {
  const available = item.availableStock ?? (item.stock - (item.reservedStock ?? 0));
  return { available, isOutOfStock: available <= 0, isLowStock: available > 0 && available <= 5 };
}

/**
 * When the cart changes elsewhere (e.g. a size added on the product page) and the size on show isn't in it,
 * switch to a size that is, so the card shows its stepper. Picking a size by hand doesn't change the cart, so it's left alone.
 */
function useFollowCartSize(sizes: StoreProduct[], selectedId: string, select: (id: string) => void, quantityOf?: (id: string) => number) {
  const inCart = quantityOf ? sizes.filter((s) => quantityOf(s.id) > 0).map((s) => `${s.id}:${quantityOf(s.id)}`).join(",") : "";
  const latest = useRef({ selectedId, sizes, quantityOf });
  latest.current = { selectedId, sizes, quantityOf };
  useEffect(() => {
    const { selectedId: current, sizes: all, quantityOf: qty } = latest.current;
    if (!qty || qty(current) > 0) return;
    const carted = all.find((s) => qty(s.id) > 0);
    if (carted) select(carted.id);
  }, [inCart, select]);
}

function StandardCard(props: FeaturedProductCardProps) {
  const { onAddToCart, onUpdateQuantity, storeId, onShowVariants, isWishlisted, onToggleWishlist, isMember, width } = props;
  const sizes = bySize(props.variants ?? [props.item]);
  const [selectedId, setSelectedId] = useState(props.item.id);
  useFollowCartSize(sizes, selectedId, setSelectedId, props.quantityOf);
  // The chosen size drives the photo, price and ADD; it starts on the cheapest (the list's primary)
  const item = sizes.find((s) => s.id === selectedId) ?? props.item;
  const quantity = props.quantityOf?.(item.id) ?? props.quantity ?? 0;
  const cardWidth = width ?? FEATURED_CARD_WIDTH;
  const tile = imageTileSize(cardWidth);
  // Swiping sizes only in grids: in a horizontal rail the swipe belongs to the rail
  const swipeable = width != null && sizes.length > 1;
  const { available, isOutOfStock, isLowStock } = stockState(item);
  const { openProduct, heartTapped } = useOpenProduct(item.product.id, storeId, props.onOpen);

  return (
    <TouchableOpacity style={[styles.card, { width: cardWidth }, width != null && styles.gridCard]} onPress={openProduct} activeOpacity={0.8}>
      <CardImage
        item={item}
        size={tile}
        isOutOfStock={isOutOfStock}
        isWishlisted={isWishlisted}
        onHeart={onToggleWishlist && (() => { heartTapped.current = true; onToggleWishlist(item.product.id); })}
        primaryId={props.item.id}
        pager={swipeable ? (
          <SizePager
            sizes={sizes} primaryId={props.item.id} index={sizes.indexOf(item)} width={tile - 2 * TILE_INSET}
            onIndex={(i) => setSelectedId(sizes[i].id)} onPress={openProduct}
          />
        ) : undefined}
        control={
          <AddControl
            item={item} quantity={quantity} variantCount={sizes.length} isOutOfStock={isOutOfStock}
            onAddToCart={onAddToCart} onUpdateQuantity={onUpdateQuantity} onShowVariants={onShowVariants} cardWidth={cardWidth}
          />
        }
      />
      <View style={styles.content}>
        <Text style={styles.unit} numberOfLines={2}>{item.variant.name}</Text>
        <PriceBlock item={item} isMember={isMember} saving={packSaving(item, sizes)} />
        <CardDetails item={item} lowStock={isLowStock ? available : null} />
      </View>
    </TouchableOpacity>
  );
}

export function FeaturedProductCard(props: FeaturedProductCardProps) {
  return props.compact ? <CompactProductCard {...props} /> : <StandardCard {...props} />;
}

const styles = StyleSheet.create({
  card: { marginRight: CARD_GAP },
  gridCard: { marginRight: 0, marginBottom: GRID_GAP + 4 },
  imageContainer: {
    backgroundColor: "#f3f5f8",
    borderRadius: 12,
    padding: TILE_INSET,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  controlCorner: { position: "absolute", right: CONTROL_INSET, bottom: CONTROL_INSET, zIndex: 3 },
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
  content: { paddingHorizontal: 2, paddingTop: 8 },
  name: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 16, minHeight: 32, color: colors.text, marginTop: 3 },
  nameSubtitle: { fontFamily: fonts.regular, fontSize: 10, color: "#94a3b8" },
  // The pack size on show, just above the price
  unit: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: colors.textSecondary, marginBottom: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 3 },
  ratingText: { fontFamily: fonts.semibold, fontSize: 10, color: "#92400e" },
  ratingCount: { fontFamily: fonts.regular, fontSize: 9.5, color: "#94a3b8" },
  lowStock: { fontFamily: fonts.semibold, fontSize: 10, color: colors.warning, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  price: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  mrp: { fontFamily: fonts.medium, fontSize: 11, color: "#94a3b8", textDecorationLine: "line-through" },
  // Sale info in the offers amber, apart from the price
  offTag: { alignSelf: "flex-start", backgroundColor: colors.accent, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginTop: 3 },
  off: { fontFamily: fonts.extrabold, fontSize: 10.5, color: colors.accentText },
  memberHint: { fontFamily: fonts.bold, fontSize: 9.5, color: "#b45309", marginTop: 1 },
  saving: { fontFamily: fonts.bold, fontSize: 10, color: "#15803d", marginTop: 1 },
  addBtn: {
    width: ADD_WIDTH, height: CONTROL_HEIGHT, borderRadius: 9,
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#fff",
    shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    alignItems: "center", justifyContent: "center",
  },
  addBtnDisabled: { borderColor: colors.border, backgroundColor: colors.surface },
  addBtnText: { fontFamily: fonts.extrabold, fontSize: 14, lineHeight: 16, color: colors.primary, letterSpacing: 0.3 },
  addBtnTextDisabled: { color: "#94a3b8" },
  optionsText: { fontFamily: fonts.medium, fontSize: 9, lineHeight: 11, color: colors.textSecondary },
  stepper: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    height: CONTROL_HEIGHT, borderRadius: 9, backgroundColor: colors.primary,
  },
  stepBtn: { flex: 1, height: CONTROL_HEIGHT, alignItems: "center", justifyContent: "center" },
  stepText: { minWidth: 20, fontFamily: fonts.extrabold, fontSize: 13, color: "#fff", textAlign: "center" },
});
