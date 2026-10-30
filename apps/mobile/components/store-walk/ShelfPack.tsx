import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { cardDeal, useDealLabel } from "../../lib/deal";
import { cartQuantity } from "../../lib/group-variants";
import { useLanguage } from "../../lib/language-context";
import { useProductActions } from "../../lib/product-actions";
import { useStrings } from "../../lib/i18n/use-strings";
import type { StoreProduct, Variant } from "../../lib/types";
import { useFly } from "./basket-fly";

// Reaches the 44pt touch target on the compact buttons
const HIT = { top: 6, bottom: 6, left: 6, right: 6 };
/** From this many left, a product's sticker says how few remain */
export const LOW_STOCK = 5;

// Packs stand to scale: the smallest (50 g or less) at 70% of the shelf's height, the largest (10 kg or more) full height,
// on a log scale between. Counted items (pieces, packs) stand in between
const GRAMS_PER: Record<string, number> = { kg: 1000, g: 1, L: 1000, ml: 1 };
const SMALLEST = Math.log10(50);
const LARGEST = Math.log10(10_000);
const MIN_SCALE = 0.7;
const COUNTED_SCALE = 0.8;
const PHOTO_OVERSIZE = 112;
// Product photos leave a white margin under the pack; the slot sinks this far behind the plank (drawn over it) so the
// pack itself stands on the wood. A store's pack render is cut tight, so it stands as it is
const SINK = 10;

function packScale(variant: Variant) {
  const amount = Number(variant.unitValue) * (GRAMS_PER[variant.unitType] ?? 0);
  if (!(amount > 0)) return COUNTED_SCALE;
  const t = Math.min(1, Math.max(0, (Math.log10(amount) - SMALLEST) / (LARGEST - SMALLEST)));
  return MIN_SCALE + (1 - MIN_SCALE) * t;
}

const photoOf = (item: StoreProduct) => item.product.imageUrl ?? item.variant.imageUrl ?? undefined;

/**
 * On the plank under the pack: a round + (which opens the size picker for a product in several sizes), then − n + once
 * added. Adding tosses the pack's photo into the walk's basket
 */
export function PlusButton({ item, variants, photo }: { item: StoreProduct; variants: StoreProduct[]; photo: () => Image | null }) {
  const t = useStrings("catalog");
  const actions = useProductActions();
  const flyer = useFly();
  const quantity = cartQuantity(variants, actions.cartQuantityMap);
  const add = () => {
    if (variants.length > 1) return actions.showVariants(variants);
    actions.addToCart(item);
    const uri = photoOf(item);
    if (uri) flyer?.fly(uri, photo());
  };
  if (quantity > 0 && variants.length === 1) {
    return (
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.step} onPress={() => actions.updateQuantity(item.id, quantity - 1)} hitSlop={HIT} accessibilityRole="button" accessibilityLabel="−">
          <Ionicons name="remove" size={16} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.stepCount}>{quantity}</Text>
        <TouchableOpacity style={styles.step} onPress={add} hitSlop={HIT} accessibilityRole="button" accessibilityLabel="+">
          <Ionicons name="add" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.plus} onPress={add} hitSlop={HIT} accessibilityRole="button" accessibilityLabel={t.addBtn}>
      <Ionicons name="add" size={20} color="#ffffff" />
      {quantity > 0 && <View style={styles.count}><Text style={styles.countText}>{quantity}</Text></View>}
    </TouchableOpacity>
  );
}

// A red flag sticking out from the shelf for a big saving or a buy-X-get-Y, as stores flag their best offers
function OfferFlag({ item }: { item: StoreProduct }) {
  const tc = useStrings("common");
  const { isMember } = useProductActions();
  const dealLabel = useDealLabel();
  const offer = item.pricing?.offer;
  const deal = cardDeal(item, isMember);
  const text = offer ? tc.buyGet(offer.buy, offer.get) : deal.highlight ? dealLabel(deal) : null;
  if (!text) return null;
  return (
    <View style={styles.flag} pointerEvents="none">
      <Text style={styles.flagText} numberOfLines={2}>{text}</Text>
    </View>
  );
}

// The owner's pick gets a teal shelf talker on the other corner from the offer flag
function OwnerTalker() {
  const t = useStrings("storeVoice");
  return (
    <View style={styles.talker} pointerEvents="none">
      <Text style={styles.talkerText} numberOfLines={2}>{t.ownersPick}</Text>
    </View>
  );
}

/** A pack standing on the shelf at its real size; its photo is handed up so its + can toss it into the basket */
export function Pack({ item, storeId, onPhoto }: { item: StoreProduct; storeId: string | undefined; onPhoto: (photo: Image | null) => void }) {
  const { getLocalizedName } = useLanguage();
  const uri = photoOf(item);
  const open = () => router.push({ pathname: "/product/[id]", params: storeId ? { id: item.product.id, storeId } : { id: item.product.id } });
  const tight = !!item.product.packPhotoUrl;
  // Drawn past the slot: product photos carry wide white margins, which vanish on the shelf, so the pack itself fills it
  const size = `${Math.round(packScale(item.variant) * (tight ? 100 : PHOTO_OVERSIZE))}%` as const;
  return (
    <View style={styles.pack}>
      <Pressable
        onPress={open} accessibilityRole="button" accessibilityLabel={getLocalizedName(item.product)}
        style={[styles.slot, !tight && styles.sunk]}
      >
        <Image ref={onPhoto} source={{ uri }} style={[styles.image, { width: size, height: size }]} />
      </Pressable>
      <OfferFlag item={item} />
      {item.ownerPick && <OwnerTalker />}
    </View>
  );
}

const styles = StyleSheet.create({
  pack: { flex: 1, alignItems: "center" },
  // A square slot; the packs stand at its foot, sized to scale
  slot: { width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "flex-end" },
  sunk: { marginBottom: -SINK },
  // Multiplied onto the white shelf, so a photo's white background drops away
  image: { resizeMode: "contain", mixBlendMode: "multiply" },
  flag: {
    position: "absolute", left: -2, top: 6, maxWidth: 64, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
    backgroundColor: "#dc2626", transform: [{ rotate: "-10deg" }],
    shadowColor: "#0f172a", shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  flagText: { fontFamily: fonts.extrabold, fontSize: 10, lineHeight: 12, color: "#ffffff", textAlign: "center" },
  talker: {
    position: "absolute", right: -2, top: 6, maxWidth: 60, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
    backgroundColor: colors.primary, transform: [{ rotate: "8deg" }],
    shadowColor: "#0f172a", shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  talkerText: { fontFamily: fonts.extrabold, fontSize: 10, lineHeight: 12, color: "#ffffff", textAlign: "center" },
  plus: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    shadowColor: "#0f172a", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  count: {
    position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#ffffff",
  },
  countText: { fontFamily: fonts.extrabold, fontSize: 10, color: colors.accentText },
  stepper: {
    height: 34, borderRadius: 17, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", paddingHorizontal: 2,
    shadowColor: "#0f172a", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  step: { width: 30, height: 34, alignItems: "center", justifyContent: "center" },
  stepCount: { fontFamily: fonts.extrabold, fontSize: 13, color: "#ffffff", minWidth: 14, textAlign: "center" },
});
