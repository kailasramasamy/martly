import { useRef } from "react";
import { View, Text, TouchableOpacity, Pressable, Image, StyleSheet, Dimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../constants/theme";
import { useLanguage } from "../lib/language-context";
import { useStrings } from "../lib/i18n/use-strings";
import { FoodTypeMark } from "./FoodTypeMark";
import { AdBadge, BestsellerBadge, BrandPickBadge, OwnerPickBadge, UnitPrice } from "./ProductBadges";
import { sizeImage } from "./PackSizes";
import { bySize, packSaving } from "../lib/pack-sizes";
import { useSponsoredTracking } from "../lib/use-sponsored";
import { cardDeal, useDealLabel } from "../lib/deal";
import { DealTag } from "./DealTag";
import { AisleLink } from "./AisleLink";
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
  onShowVariants?: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string) => void;
  isMember?: boolean;
  variants?: StoreProduct[];
  quantityOf?: (storeProductId: string) => number;
  // Called as the product page opens (search result tracking)
  onOpen?: () => void;
  // Ends the details with a link to the product's subcategory aisle
  aisleLink?: boolean;
}

// With several sizes every control opens the size sheet, as on the larger cards, since which size to change is ambiguous
export function CompactControl({ item, quantity, outOfStock, options, onAddToCart, onUpdateQuantity, onShowVariants }:
  Required<Pick<CompactProductCardProps, "quantity">> & Pick<CompactProductCardProps, "item" | "onAddToCart" | "onUpdateQuantity" | "onShowVariants">
  & { outOfStock: boolean; options: number }) {
  const t = useStrings("catalog");
  const choose = options > 1 ? onShowVariants : undefined;
  const increment = choose ?? (() => onAddToCart(item));
  const decrement = choose ?? (() => onUpdateQuantity(item.id, quantity - 1));
  if (quantity > 0) {
    return (
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={decrement} hitSlop={HIT_SLOP} accessibilityLabel={t.removeOne}>
          <Ionicons name="remove" size={14} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.stepText}>{quantity}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={increment} hitSlop={HIT_SLOP} accessibilityLabel={t.addOneMore}>
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
      accessibilityLabel={choose ? t.addChooseSize(options) : t.addToCartLabel}
    >
      <Text style={[styles.addText, outOfStock && styles.addTextDisabled]}>{t.addBtn}</Text>
      {choose && !outOfStock && <Text style={styles.optionsText} numberOfLines={1}>{t.options(options)}</Text>}
    </TouchableOpacity>
  );
}

function CompactImage({ item, primaryId, outOfStock, wished, onHeart }: {
  item: StoreProduct; primaryId: string; outOfStock: boolean; wished?: boolean; onHeart?: () => void;
}) {
  const t = useStrings("catalog");
  const tc = useStrings("common");
  const uri = sizeImage(item, primaryId);
  return (
    <View style={styles.imageContainer}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      ) : (
        <Text style={styles.noImageLetter}>{item.product.name.charAt(0)}</Text>
      )}
      {item.product.foodType && <FoodTypeMark foodType={item.product.foodType} />}
      {item.brandPick ? <BrandPickBadge pick={item.brandPick} /> : item.product.isBestseller && <BestsellerBadge />}
      {outOfStock && (
        <View style={styles.oos}><Text style={styles.oosLabel}>{tc.outOfStock}</Text></View>
      )}
      {onHeart && (
        <Pressable style={styles.heart} onPress={onHeart} hitSlop={8} accessibilityLabel={t.toggleWishlist}>
          <Ionicons name={wished ? "heart" : "heart-outline"} size={14} color={wished ? "#ef4444" : "#94a3b8"} />
        </Pressable>
      )}
    </View>
  );
}

// The pack size shown; other sizes are picked from ADD's size sheet
function CompactDetails({ item, sizes, isMember, sponsored, aisleLink }: {
  item: StoreProduct; sizes: StoreProduct[]; isMember?: boolean; sponsored: boolean; aisleLink?: boolean;
}) {
  const { getLocalizedName } = useLanguage();
  const deal = cardDeal(item, !!isMember);
  const discount = useDealLabel()(deal);
  const saving = packSaving(item, sizes);
  const rated = (item.product.reviewCount ?? 0) > 0 && (item.product.averageRating ?? 0) > 0;
  return (
    <>
      {sponsored ? <AdBadge /> : item.ownerPick && <OwnerPickBadge />}
      <Text style={styles.unit} numberOfLines={1}>{item.variant.name}</Text>
      <View style={styles.priceRow}>
        <Text style={[styles.price, deal.highlight && styles.highlight]} numberOfLines={1}>{"₹"}{deal.shown.toFixed(0)}</Text>
        {deal.struck != null && <Text style={styles.mrp}>{"₹"}{deal.struck.toFixed(0)}</Text>}
      </View>
      <UnitPrice price={deal.shown} variant={item.variant} />
      <DealTag deal={deal} label={discount} offer={item.pricing?.offer} />
      {saving && <Text style={styles.saving}>{saving}</Text>}
      <Text style={styles.name} numberOfLines={3}>{getLocalizedName(item.product)}</Text>
      {rated && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={10} color="#f59e0b" />
          <Text style={styles.ratingText}>{item.product.averageRating!.toFixed(1)}</Text>
          <Text style={styles.ratingCount}>({item.product.reviewCount})</Text>
        </View>
      )}
      {aisleLink && <AisleLink subcategory={item.product.subcategory} />}
    </>
  );
}

export function CompactProductCard(props: CompactProductCardProps) {
  const { storeId, onToggleWishlist, isWishlisted } = props;
  const sizes = bySize(props.variants ?? [props.item]);
  // The card shows the cheapest size (the list's primary); the rest are a tap on ADD away
  const item = props.item;
  const quantity = props.quantityOf?.(item.id) ?? props.quantity ?? 0;
  const available = item.availableStock ?? (item.stock - (item.reservedStock ?? 0));
  const heartTapped = useRef(false);
  const tapSponsored = useSponsoredTracking(props.item.sponsored, storeId);

  const openProduct = () => {
    if (heartTapped.current) { heartTapped.current = false; return; }
    const params: Record<string, string> = { id: item.product.id };
    if (storeId) params.storeId = storeId;
    tapSponsored();
    props.onOpen?.();
    router.push({ pathname: "/product/[id]", params });
  };

  return (
    <TouchableOpacity style={styles.card} onPress={openProduct} activeOpacity={0.8}>
      <CompactImage
        item={item}
        primaryId={props.item.id}
        outOfStock={available <= 0}
        wished={isWishlisted}
        onHeart={onToggleWishlist && (() => { heartTapped.current = true; onToggleWishlist(item.product.id); })}
      />
      <View style={styles.controlOverlay}>
        <CompactControl
          item={item} quantity={quantity} outOfStock={available <= 0} options={sizes.length}
          onAddToCart={props.onAddToCart} onUpdateQuantity={props.onUpdateQuantity} onShowVariants={props.onShowVariants}
        />
      </View>
      <View style={styles.content}>
        <CompactDetails
          item={item} sizes={sizes} isMember={props.isMember}
          sponsored={!!props.item.sponsored} aisleLink={props.aisleLink}
        />
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
  content: { paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8 },
  // Sits beside the lower half of ADD (which overhangs the photo), so it keeps clear of the button
  unit: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.textSecondary, marginRight: CONTROL_WIDTH },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: CONTROL_HEIGHT / 2 - 12 },
  price: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text },
  mrp: { fontFamily: fonts.medium, fontSize: 11, color: "#94a3b8", textDecorationLine: "line-through" },
  highlight: { backgroundColor: colors.salePill, paddingHorizontal: 4, borderRadius: 4 },
  saving: { fontFamily: fonts.bold, fontSize: 9.5, color: "#15803d", marginTop: 1 },
  name: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15, color: colors.text, marginTop: 3 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 3 },
  ratingText: { fontFamily: fonts.semibold, fontSize: 10, color: "#92400e" },
  ratingCount: { fontFamily: fonts.regular, fontSize: 9.5, color: "#94a3b8" },
  addBtn: {
    width: CONTROL_WIDTH, height: CONTROL_HEIGHT, borderRadius: 8, borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    borderRightWidth: 3, borderBottomWidth: 3,
  },
  addBtnDisabled: { borderColor: colors.border, backgroundColor: colors.surface },
  addText: { fontFamily: fonts.extrabold, fontSize: 12, lineHeight: 14, color: colors.primary, letterSpacing: 0.3 },
  optionsText: { fontFamily: fonts.medium, fontSize: 8, lineHeight: 10, color: colors.textSecondary },
  addTextDisabled: { color: "#94a3b8" },
  stepper: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    width: CONTROL_WIDTH, height: CONTROL_HEIGHT, borderRadius: 8, backgroundColor: colors.primary,
  },
  stepBtn: { width: 20, height: CONTROL_HEIGHT, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: fonts.extrabold, fontSize: 12, color: "#fff", textAlign: "center" },
});
