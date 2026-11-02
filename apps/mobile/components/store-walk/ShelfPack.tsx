import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, TouchableOpacity, View, type ImageLoadEventData, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { cardDeal } from "../../lib/deal";
import { cartQuantity } from "../../lib/group-variants";
import { useLanguage } from "../../lib/language-context";
import { useProductActions } from "../../lib/product-actions";
import { useStrings } from "../../lib/i18n/use-strings";
import type { StoreProduct, Variant, WalkPack } from "../../lib/types";
import { useFly } from "./basket-fly";
import { BestsellerTag, frames, NewBurst, OfferFlag, OwnerTalker, Shine, TrendingTag, usePlayOnce, type Motion } from "./PackSignals";

// Reaches the 44pt touch target on the compact buttons
const HIT = { top: 5, bottom: 5, left: 5, right: 5 };

// Packs stand to scale: the smallest (50 g or less) at 70% of the shelf's height, the largest (10 kg or more) full height,
// on a log scale between. Counted items (pieces, packs) stand in between
const GRAMS_PER: Record<string, number> = { kg: 1000, g: 1, L: 1000, ml: 1 };
const SMALLEST = Math.log10(50);
const LARGEST = Math.log10(10_000);
const MIN_SCALE = 0.7;
const COUNTED_SCALE = 0.8;
// A pack never fills its slot's whole width, so neighbours don't touch
const MAX_WIDTH = 0.94;
/** The room above the plank, in slot widths: packs stand taller than the slot is wide */
const SHELF_RISE = 1.4;
// Most packs stand taller than wide; the real shape takes over once the photo loads
const GUESS_ASPECT = 0.72;

function packScale(variant: Variant) {
  const amount = Number(variant.unitValue) * (GRAMS_PER[variant.unitType] ?? 0);
  if (!(amount > 0)) return COUNTED_SCALE;
  const t = Math.min(1, Math.max(0, (Math.log10(amount) - SMALLEST) / (LARGEST - SMALLEST)));
  return MIN_SCALE + (1 - MIN_SCALE) * t;
}

export const photoOf = (item: StoreProduct) => item.product.imageUrl ?? item.variant.imageUrl ?? undefined;
/** The pack without its background: its cut-out, or a store's pack render (already cut tight) */
export const cutoutOf = (item: StoreProduct) => item.product.cutoutUrl ?? (item.product.packPhotoUrl ? photoOf(item) : undefined);

// How long − n + stays open on the pack after a tap, before it folds back to the count
const STEPPER_OPEN_MS = 2500;

function useBriefly() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const keepOpen = () => {
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), STEPPER_OPEN_MS);
  };
  return { open, keepOpen };
}

/**
 * On the pack's foot: a round + (which opens the size picker for a product in several sizes). Once added it shows the
 * count, which opens − n + for a moment, so the stepper doesn't sit over the pack. Adding tosses the pack's photo into
 * the walk's basket
 */
export function PlusButton({ item, variants, photo }: { item: StoreProduct; variants: StoreProduct[]; photo: () => Image | null }) {
  const t = useStrings("catalog");
  const actions = useProductActions();
  const flyer = useFly();
  const quantity = cartQuantity(variants, actions.cartQuantityMap);
  const { open, keepOpen } = useBriefly();
  const uri = cutoutOf(item) ?? photoOf(item);
  const add = () => {
    if (variants.length > 1) return actions.showVariants(variants);
    actions.addToCart(item);
    keepOpen();
    if (uri) flyer?.fly(uri, photo());
  };
  // Taken out of the bag: the pack flies back out of the basket onto its shelf
  const remove = () => {
    actions.updateQuantity(item.id, quantity - 1);
    keepOpen();
    if (uri) flyer?.flyBack(uri, photo());
  };
  if (quantity > 0 && variants.length === 1 && !open) {
    return (
      <TouchableOpacity style={styles.plus} onPress={keepOpen} hitSlop={HIT} accessibilityRole="button" accessibilityLabel={String(quantity)}>
        <Text style={styles.stepCount}>{quantity}</Text>
      </TouchableOpacity>
    );
  }
  if (quantity > 0 && variants.length === 1) {
    return (
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.step} onPress={remove} hitSlop={HIT} accessibilityRole="button" accessibilityLabel="−">
          <Ionicons name="remove" size={19} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.stepCount}>{quantity}</Text>
        <TouchableOpacity style={styles.step} onPress={add} hitSlop={HIT} accessibilityRole="button" accessibilityLabel="+">
          <Ionicons name="add" size={19} color="#ffffff" />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.plus} onPress={add} hitSlop={HIT} accessibilityRole="button" accessibilityLabel={t.addBtn}>
      <Ionicons name="add" size={21} color="#ffffff" />
      {quantity > 0 && <View style={styles.count}><Text style={styles.countText}>{quantity}</Text></View>}
    </TouchableOpacity>
  );
}

// The pack's size on the shelf: to scale in height, within the slot's width, in the photo's own shape
function usePackSize(slot: number, item: StoreProduct) {
  const [aspect, setAspect] = useState(GUESS_ASPECT);
  const height = Math.min(slot * SHELF_RISE * packScale(item.variant), (slot * MAX_WIDTH) / aspect);
  const onLoad = ({ nativeEvent: { source } }: NativeSyntheticEvent<ImageLoadEventData>) => {
    if (source.width && source.height) setAspect(source.width / source.height);
  };
  return { width: height * aspect, height, onLoad };
}

// A buy-X-get-Y: the free pack slides out from behind the front one, wobbles, and its "FREE" tag pops on
function FreePack({ uri, width, height, motion }: { uri: string; width: number; height: number; motion: Motion }) {
  const t = useStrings("storeWalk");
  const v = usePlayOnce(motion, 1100, 300);
  const style = {
    width: width * 0.9, height: height * 0.9,
    transform: [{ translateX: frames(v, [-18, 16, 14, 15, 14]) }, { rotate: frames(v, ["0deg", "9deg", "3deg", "8deg", "6deg"]) }],
  };
  return (
    <Animated.View style={[styles.free, style]} pointerEvents="none">
      <Image source={{ uri }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.freeTag, { opacity: frames(v, [0, 0, 0, 1, 1]) }]}>
        <Text style={styles.freeText}>{t.free}</Text>
      </Animated.View>
    </Animated.View>
  );
}

interface StandProps { item: WalkPack; uri: string; slot: number; motion: Motion; onPhoto: (photo: Image | null) => void }

/** A cut-out pack standing on the shelf, leaning alone when few are left */
function CutPack({ item, uri, slot, motion, onPhoto }: StandProps) {
  const { width, height, onLoad } = usePackSize(slot, item);
  const shake = usePlayOnce(motion, 800, 400);
  const { stockLevel, bestseller } = item.shelf;
  const bogo = !!item.pricing?.offer;
  const lean = stockLevel === "low" ? { transform: [{ rotate: frames(shake, ["0deg", "-4deg", "3deg", "-4deg", "2deg", "-5deg"]) }] } : null;
  return (
    <Animated.View style={[{ width, height, transformOrigin: "bottom" }, lean]}>
      {bogo && <FreePack uri={uri} width={width} height={height} motion={motion} />}
      <View style={[styles.contact, { width: width * 0.8, left: width * 0.1 }]} />
      <Image ref={onPhoto} source={{ uri }} style={[styles.lit, { width, height }]} onLoad={onLoad} />
      {bestseller && <View style={styles.shineClip} pointerEvents="none"><Shine motion={motion} width={width} /></View>}
    </Animated.View>
  );
}

// A pack with no cut-out stands on a white plate, so its photo's white background reads as the plate
function PlatedPack({ item, slot, onPhoto }: Omit<StandProps, "uri" | "motion">) {
  const height = Math.min(slot * SHELF_RISE * packScale(item.variant) * 0.92, (slot * MAX_WIDTH) / 0.8);
  return (
    <View style={[styles.plate, { height, width: height * 0.8 }]}>
      <Image ref={onPhoto} source={{ uri: photoOf(item) }} style={styles.plateImage} />
    </View>
  );
}

// What the pack calls out: the offer flag, bestseller and shoppers this week stacked down its left; the owner's pick or
// new on its right, clear of the + at its foot
function Tags({ item, motion }: { item: WalkPack; motion: Motion }) {
  const { isMember } = useProductActions();
  const { shelf } = item;
  const flagged = !!item.pricing?.offer || cardDeal(item, isMember).highlight;
  return (
    <>
      <OfferFlag item={item} motion={motion} />
      {shelf.bestseller && <BestsellerTag motion={motion} raised={flagged} />}
      {item.ownerPick ? <OwnerTalker motion={motion} />
        : shelf.isNew ? <NewBurst motion={motion} /> : null}
      {!!shelf.boughtThisWeek && <TrendingTag count={shelf.boughtThisWeek} motion={motion} under={Number(flagged) + Number(shelf.bestseller)} />}
    </>
  );
}

interface PackProps { item: WalkPack; slot: number; motion: Motion; onLift: () => void; onPhoto: (photo: Image | null) => void }

/** A pack standing on the shelf at its real size; tapping it picks it up. Its photo is handed up for the + to toss */
export function Pack({ item, slot, motion, onLift, onPhoto }: PackProps) {
  const { getLocalizedName } = useLanguage();
  const uri = cutoutOf(item);
  return (
    <View style={[styles.pack, { height: slot * SHELF_RISE }]}>
      <Pressable onPress={onLift} accessibilityRole="button" accessibilityLabel={getLocalizedName(item.product)} style={styles.stand}>
        {uri
          ? <CutPack item={item} uri={uri} slot={slot} motion={motion} onPhoto={onPhoto} />
          : <PlatedPack item={item} slot={slot} onPhoto={onPhoto} />}
      </Pressable>
      <Tags item={item} motion={motion} />
    </View>
  );
}

const styles = StyleSheet.create({
  pack: { flex: 1 },
  stand: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  // iOS draws a transparent image's shadow along the pack's own outline
  lit: { resizeMode: "contain", shadowColor: "#000000", shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 3 } },
  free: { position: "absolute", right: -6, bottom: 2, transformOrigin: "bottom" },
  freeTag: { position: "absolute", top: 6, right: -6, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: "#16a34a", transform: [{ rotate: "-6deg" }] },
  freeText: { fontFamily: fonts.extrabold, fontSize: 9, color: "#ffffff" },
  // The pack's shadow on the plank
  contact: { position: "absolute", bottom: -3, height: 8, borderRadius: 8, backgroundColor: "rgba(15,23,42,0.28)" },
  shineClip: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  plate: {
    padding: 3, borderRadius: 5, backgroundColor: "#ffffff",
    shadowColor: "#000000", shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  plateImage: { flex: 1, resizeMode: "contain" },
  plus: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#ffffff",
    shadowColor: "#0f172a", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  count: {
    position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#ffffff",
  },
  countText: { fontFamily: fonts.extrabold, fontSize: 10, color: colors.accentText },
  stepper: {
    height: 34, borderRadius: 17, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", paddingHorizontal: 2,
    borderWidth: 2, borderColor: "#ffffff",
    shadowColor: "#0f172a", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  step: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  stepCount: { fontFamily: fonts.extrabold, fontSize: 15, color: "#ffffff", minWidth: 16, textAlign: "center" },
});
