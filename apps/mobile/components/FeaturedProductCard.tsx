import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Pressable, Image, StyleSheet, Dimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../constants/theme";
import type { StoreProduct } from "../lib/types";
import { useLanguage } from "../lib/language-context";
import { useStrings } from "../lib/i18n/use-strings";
import { FoodTypeMark } from "./FoodTypeMark";
import { AdBadge, BestsellerBadge, BrandPickBadge, OwnerPickBadge, UnitPrice } from "./ProductBadges";
import { CompactProductCard } from "./CompactProductCard";
import { bySize, packSaving } from "../lib/pack-sizes";
import { SizePager, sizeImage } from "./PackSizes";
import { useSponsoredTracking } from "../lib/use-sponsored";
import { cardDeal, useDealLabel } from "../lib/deal";
import { DealTag } from "./DealTag";
import { AisleLink } from "./AisleLink";

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
const UNIT_PICK_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

interface FeaturedProductCardProps {
  item: StoreProduct;
  onAddToCart: (sp: StoreProduct, quantity?: number) => void;
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
  // White card with a soft shadow and a white photo tile, so products stand out on a coloured screen
  elevated?: boolean;
  // 3-column search layout: smaller card, "N options" instead of the sizes row
  compact?: boolean;
  // Called as the product page opens (search result tracking)
  onOpen?: () => void;
  // Quick add (list review): open on this size, and ADD adds the size on show this many at once, sheet-free
  preferredId?: string;
  addCount?: (sp: StoreProduct) => number;
  // Ends the details with a link to the product's subcategory aisle
  aisleLink?: boolean;
}

// A square photo tile with ADD in its bottom-right corner, Zepto-style
function CardImage({ item, primaryId, size, isOutOfStock, isWishlisted, onHeart, pager, control, elevated }: {
  item: StoreProduct; primaryId: string; size: number; isOutOfStock: boolean; isWishlisted?: boolean; onHeart?: () => void;
  pager?: React.ReactNode; control: React.ReactNode; elevated?: boolean;
}) {
  const t = useStrings("catalog");
  const tc = useStrings("common");
  const productImage = sizeImage(item, primaryId);
  return (
    <View style={[styles.imageContainer, { width: size, height: size }, elevated && styles.imageElevated]}>
      {pager ?? (productImage ? (
        <Image source={{ uri: productImage }} style={styles.image} resizeMode="contain" />
      ) : (
        <Text style={styles.noImageLetter}>{item.product.name.charAt(0)}</Text>
      ))}
      {item.product.foodType && <FoodTypeMark foodType={item.product.foodType} />}
      {item.brandPick ? <BrandPickBadge pick={item.brandPick} /> : item.product.isBestseller && <BestsellerBadge />}
      {isOutOfStock && (
        <View style={styles.oosOverlay}>
          <Text style={styles.oosLabel}>{tc.outOfStock}</Text>
        </View>
      )}
      {onHeart && (
        <Pressable style={styles.heartBtn} onPress={onHeart} hitSlop={8} accessibilityLabel={t.toggleWishlist}>
          <Ionicons name={isWishlisted ? "heart" : "heart-outline"} size={15} color={isWishlisted ? "#ef4444" : "#94a3b8"} />
        </Pressable>
      )}
      <View style={styles.controlCorner}>{control}</View>
    </View>
  );
}

function PriceBlock({ item, isMember, saving }: { item: StoreProduct; isMember?: boolean; saving?: string | null }) {
  const t = useStrings("catalog");
  const deal = cardDeal(item, !!isMember);
  const dealText = useDealLabel()(deal);
  const memberPrice = item.pricing?.memberPrice;
  const memberCheaper = memberPrice != null && memberPrice < (item.pricing?.discountActive ? item.pricing.effectivePrice : Number(item.price));
  return (
    <View>
      <View style={styles.priceRow}>
        <Text style={[styles.price, deal.highlight && styles.highlight]} numberOfLines={1}>{"\u20B9"}{deal.shown.toFixed(0)}</Text>
        {deal.struck != null && <Text style={styles.mrp}>{"\u20B9"}{deal.struck.toFixed(0)}</Text>}
      </View>
      <UnitPrice price={deal.shown} variant={item.variant} />
      <DealTag deal={deal} label={dealText} offer={item.pricing?.offer} />
      {saving && <Text style={styles.saving}>{saving}</Text>}
      {!isMember && memberCheaper && (
        <Text style={styles.memberHint}>{t.withPlus(memberPrice!.toFixed(0))}</Text>
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
  const t = useStrings("catalog");
  const hasOptions = variantCount > 1 && onShowVariants != null;
  const increment = hasOptions ? onShowVariants : () => onAddToCart(item);
  const decrement = hasOptions ? onShowVariants : () => onUpdateQuantity(item.id, quantity - 1);

  if (quantity > 0) {
    return (
      <View style={[styles.stepper, { width: stepperWidth(cardWidth) }]}>
        <TouchableOpacity style={styles.stepBtn} onPress={decrement} hitSlop={STEP_HIT_SLOP} accessibilityLabel={t.removeOne}>
          <Ionicons name="remove" size={17} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.stepText}>{quantity}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={increment} hitSlop={STEP_HIT_SLOP} accessibilityLabel={t.addOneMore}>
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
      accessibilityLabel={hasOptions ? t.addChooseSize(variantCount) : t.addToCartLabel}
    >
      <Text style={[styles.addBtnText, isOutOfStock && styles.addBtnTextDisabled]}>{t.addBtn}</Text>
      {hasOptions && !isOutOfStock && <Text style={styles.optionsText} numberOfLines={1}>{t.options(variantCount)}</Text>}
    </TouchableOpacity>
  );
}

function CardDetails({ item, lowStock, sponsored, aisleLink }: { item: StoreProduct; lowStock: number | null; sponsored: boolean; aisleLink?: boolean }) {
  const { getLocalizedName } = useLanguage();
  const t = useStrings("catalog");
  return (
    <>
      {sponsored ? <AdBadge /> : item.ownerPick && <OwnerPickBadge />}
      <Text style={styles.name} numberOfLines={3}>{getLocalizedName(item.product)}</Text>
      {(item.product.averageRating ?? 0) > 0 && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={10} color="#f59e0b" />
          <Text style={styles.ratingText}>{item.product.averageRating!.toFixed(1)}</Text>
          {(item.product.reviewCount ?? 0) > 0 && <Text style={styles.ratingCount}>({item.product.reviewCount})</Text>}
        </View>
      )}
      {lowStock != null && <Text style={styles.lowStock}>{t.onlyLeft(lowStock)}</Text>}
      {aisleLink && <AisleLink subcategory={item.product.subcategory} />}
    </>
  );
}

/** Opens the product page on a card tap, unless the tap was on the wishlist heart */
function useOpenProduct(productId: string, sizeId: string, storeId: string | undefined, onOpen?: () => void) {
  const heartTapped = useRef(false);
  const openProduct = () => {
    if (heartTapped.current) { heartTapped.current = false; return; }
    const params: Record<string, string> = { id: productId, size: sizeId };
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
  const { onAddToCart, onUpdateQuantity, storeId, onShowVariants, isWishlisted, onToggleWishlist, isMember, width, elevated } = props;
  const sizes = bySize(props.variants ?? [props.item]);
  const [selectedId, setSelectedId] = useState(props.preferredId ?? props.item.id);
  const quick = props.addCount != null;
  useFollowCartSize(sizes, selectedId, setSelectedId, props.quantityOf);
  // The chosen size drives the photo, price and ADD; it starts on the cheapest (the list's primary)
  const item = sizes.find((s) => s.id === selectedId) ?? props.item;
  const quantity = props.quantityOf?.(item.id) ?? props.quantity ?? 0;
  // Quick add: before it's in the cart, the size line says how many packs ADD will put in ("2 × 1kg")
  const packs = quick && quantity === 0 ? props.addCount!(item) : 1;
  const unitLabel = packs > 1 ? `${packs} × ${item.variant.name}` : item.variant.name;
  const cardWidth = width ?? FEATURED_CARD_WIDTH;
  const tile = imageTileSize(cardWidth);
  // Swiping sizes only in grids: in a horizontal rail the swipe belongs to the rail
  const swipeable = width != null && sizes.length > 1;
  const { available, isOutOfStock, isLowStock } = stockState(item);
  const tapSponsored = useSponsoredTracking(props.item.sponsored, storeId);
  const { openProduct, heartTapped } = useOpenProduct(item.product.id, item.id, storeId, () => { tapSponsored(); props.onOpen?.(); });

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }, width != null && styles.gridCard, elevated && styles.elevated]}
      onPress={openProduct}
      activeOpacity={0.8}
    >
      <CardImage
        elevated={elevated}
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
            // Quick add: the first tap adds the packs asked for, + adds one more
            onAddToCart={quick ? (sp) => onAddToCart(sp, quantity > 0 ? 1 : props.addCount!(sp)) : onAddToCart}
            onUpdateQuantity={onUpdateQuantity} onShowVariants={quick ? undefined : onShowVariants} cardWidth={cardWidth}
          />
        }
      />
      <View style={[styles.content, elevated && styles.contentElevated]}>
        {quick && sizes.length > 1 && onShowVariants ? (
          <TouchableOpacity style={styles.unitPick} onPress={onShowVariants} hitSlop={UNIT_PICK_SLOP} accessibilityRole="button">
            <Text style={styles.unitPickText} numberOfLines={1}>{unitLabel}</Text>
            <Ionicons name="chevron-down" size={15} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <Text style={[styles.unit, packs > 1 && styles.unitPacks]} numberOfLines={2}>{unitLabel}</Text>
        )}
        <PriceBlock item={item} isMember={isMember} saving={packSaving(item, sizes)} />
        <CardDetails item={item} lowStock={isLowStock ? available : null} sponsored={!!props.item.sponsored} aisleLink={props.aisleLink} />
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
  elevated: {
    backgroundColor: "#ffffff", borderRadius: 16,
    shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  imageElevated: { backgroundColor: "#ffffff" },
  contentElevated: { paddingHorizontal: 10, paddingBottom: 10 },
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
  content: { paddingHorizontal: 2, paddingTop: 4 },
  name: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 16, minHeight: 32, color: colors.text, marginTop: 3 },
  // The pack size on show, just above the price
  unit: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: colors.textSecondary },
  // Quick add's size switch: a full-width pill, 32 tall with slop to a 44 tap target
  unitPick: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, minHeight: 32, marginTop: 2, marginBottom: 6,
    paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#99f6e4", backgroundColor: "#f0fdfa",
  },
  unitPickText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.primaryDark },
  unitPacks: { fontFamily: fonts.semibold, color: colors.primaryDark },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 3 },
  ratingText: { fontFamily: fonts.semibold, fontSize: 10, color: "#92400e" },
  ratingCount: { fontFamily: fonts.regular, fontSize: 9.5, color: "#94a3b8" },
  lowStock: { fontFamily: fonts.semibold, fontSize: 10, color: colors.warning, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  price: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  highlight: { backgroundColor: colors.salePill, paddingHorizontal: 4, borderRadius: 4 },
  mrp: { fontFamily: fonts.medium, fontSize: 11, color: "#94a3b8", textDecorationLine: "line-through" },
  memberHint: { fontFamily: fonts.bold, fontSize: 9.5, color: "#b45309", marginTop: 1 },
  saving: { fontFamily: fonts.bold, fontSize: 10, color: "#15803d", marginTop: 1 },
  addBtn: {
    width: ADD_WIDTH, height: CONTROL_HEIGHT, borderRadius: 9,
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#fff",
    borderRightWidth: 3, borderBottomWidth: 3,
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
