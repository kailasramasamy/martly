import { useMemo, useRef } from "react";
import { StyleSheet, Text, View, useWindowDimensions, type Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { storeBrandName } from "@martly/shared/constants";
import { colors, fonts } from "../../constants/theme";
import { cardDeal } from "../../lib/deal";
import { groupByProduct } from "../../lib/group-variants";
import { useLanguage } from "../../lib/language-context";
import { useProductActions } from "../../lib/product-actions";
import { useStore } from "../../lib/store-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { StoreProduct, WalkPack } from "../../lib/types";
import { ShelfPrice } from "./ShelfPrice";
import { Pack, PlusButton } from "./ShelfPack";

export const PER_SHELF = 3;
// The shelf unit runs nearly edge to edge: the list's 16pt gutter, less this much each side
const BLEED = 8;
const WOOD = "#c89b62";
const WOOD_FACE = "#b0824b";
// The unit's wooden uprights, and the room between them and the packs
const UPRIGHT = 11;
const INSET = 4;
const GAP = 6;
// A shelf's packs that move when it comes into view; the rest stand still, so a shelf never turns into a fairground
const MOVING_PER_SHELF = 2;

// Each label sits a little askew, as if stuck on by hand
const TILTS = ["-1.5deg", "1deg", "-0.5deg"];

// Each pack's name for its label. Two or more of a brand on one shelf drop the brand, which their packs already show, so
// the two lines go to what tells them apart. A store's own pack has no brand of its own; it sells under the store's
function useLabelNames(items: WalkPack[]) {
  const { language, getLocalizedName } = useLanguage();
  const { selectedStore } = useStore();
  const own = selectedStore && (selectedStore.translations?.[language ?? ""]?.brandName || storeBrandName(selectedStore));
  const brandOf = (sp: WalkPack) => sp.product.brand?.name ?? own ?? "";
  const counts = new Map<string, number>();
  for (const sp of items) counts.set(brandOf(sp), (counts.get(brandOf(sp)) ?? 0) + 1);
  return (sp: WalkPack) => {
    const name = getLocalizedName(sp.product);
    const prefix = `${brandOf(sp)} `;
    return counts.get(brandOf(sp))! > 1 && name.toLowerCase().startsWith(prefix.toLowerCase()) ? name.slice(prefix.length) : name;
  };
}

// The label on the shelf's price rail under a pack: the price in bold with the size beside it, then the name on two
// lines, and how few are left when stock runs low. The pack's deal is on its flag
function Sticker({ item, variants, name, i }: { item: WalkPack; variants: StoreProduct[]; name: string; i: number }) {
  const t = useStrings("catalog");
  const { isMember } = useProductActions();
  const deal = cardDeal(item, isMember);
  return (
    <View style={[styles.sticker, { transform: [{ rotate: TILTS[i % TILTS.length] }] }]}>
      <View style={styles.priceRow}>
        <ShelfPrice amount={deal.shown} size={20} />
        {deal.struck != null && <Text style={styles.struck}>{"\u20B9"}{Math.round(deal.struck)}</Text>}
        <Text style={styles.size} numberOfLines={1}>{variants.length > 1 ? t.options(variants.length) : item.variant.name}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
      {item.shelf.stockLevel === "low" && <Text style={styles.low}>{t.onlyLeft(item.availableStock)}</Text>}
    </View>
  );
}

// Anything the pack calls out, so the shelf knows which two to move
function callsOut(sp: WalkPack, isMember: boolean) {
  const { shelf } = sp;
  return !!sp.pricing?.offer || cardDeal(sp, isMember).highlight || shelf.bestseller || !!sp.ownerPick
    || !!shelf.boughtThisWeek || shelf.isNew || shelf.stockLevel === "low";
}

/** Each slot's width (packs stand in a square), from the screen's width */
function useSlot() {
  const { width } = useWindowDimensions();
  const inner = width - 2 * (16 - BLEED) - 2 * UPRIGHT - 2 * INSET;
  return (inner - GAP * (PER_SHELF - 1)) / PER_SHELF;
}

function Uprights() {
  return (
    <>
      {["left", "right"].map((side) => (
        <LinearGradient
          key={side} colors={[WOOD_FACE, WOOD, WOOD_FACE]} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[styles.upright, side === "left" ? { left: 0 } : { right: 0 }]} pointerEvents="none"
        />
      ))}
    </>
  );
}

interface ShelfProps {
  items: WalkPack[];
  variantsOf: Map<string, StoreProduct[]>;
  /** The shelf has come into view: its two signalled packs play their animation, once */
  play: boolean;
  /** A pack was picked up off the shelf */
  onLift: (item: WalkPack, variants: StoreProduct[]) => void;
  /** The unit's top and foot, on its first and last shelf */
  first?: boolean;
  last?: boolean;
}

/**
 * One shelf of a wooden shelf unit: a pale back, up to three packs standing on the plank, and the price rail
 * along its front edge with each pack's label. Stacked shelves read as one unit
 */
export function Shelf({ items, variantsOf, play, onLift, first, last }: ShelfProps) {
  const { isMember } = useProductActions();
  const labelName = useLabelNames(items);
  const slot = useSlot();
  const photos = useRef(new Map<string, Image | null>());
  const slots = [...items, ...Array(PER_SHELF - items.length).fill(null)] as (WalkPack | null)[];
  const variants = (sp: StoreProduct) => variantsOf.get(sp.product.id) ?? [sp];
  const moving = items.filter((sp) => callsOut(sp, isMember)).slice(0, MOVING_PER_SHELF).map((sp) => sp.id);
  return (
    <View style={[styles.shelf, first && styles.top, last && styles.foot]}>
      <Uprights />
      {!first && <LinearGradient colors={["rgba(70,45,20,0.2)", "rgba(70,45,20,0)"]} style={styles.shade} pointerEvents="none" />}
      <View style={styles.row}>
        {slots.map((sp, i) => (sp ? (
          <View key={sp.id} style={styles.slot}>
            <Pack
              item={sp} slot={slot} motion={{ play, animate: moving.includes(sp.id) }}
              onLift={() => onLift(sp, variants(sp))} onPhoto={(photo) => photos.current.set(sp.id, photo)}
            />
            <View style={styles.plusSpot}>
              <PlusButton item={sp} variants={variants(sp)} photo={() => photos.current.get(sp.id) ?? null} />
            </View>
          </View>
        ) : <View key={i} style={styles.slot} />))}
      </View>
      <LinearGradient colors={["#d8ae78", WOOD]} style={styles.deck} />
      <LinearGradient colors={[WOOD, WOOD_FACE]} style={styles.rail} />
      <View style={[styles.row, styles.stickers]}>
        {slots.map((sp, i) => (sp ? (
          <View key={sp.id} style={styles.slot}>
            <Sticker item={sp} variants={variants(sp)} name={labelName(sp)} i={i} />
          </View>
        ) : <View key={i} style={styles.slot} />))}
      </View>
    </View>
  );
}

/** The aisle's products as a shop shelf unit: rows of three packs, priced on labels along each shelf's rail */
export function useShelves(products: WalkPack[]) {
  return useMemo(() => {
    const { primary, variantsByProductId } = groupByProduct(products);
    const shelves: WalkPack[][] = [];
    for (let i = 0; i < primary.length; i += PER_SHELF) shelves.push(primary.slice(i, i + PER_SHELF) as WalkPack[]);
    return { shelves, variantsOf: variantsByProductId };
  }, [products]);
}

const styles = StyleSheet.create({
  shelf: { marginHorizontal: -BLEED, paddingHorizontal: UPRIGHT + INSET, paddingBottom: 14, backgroundColor: "#f7f1e6" },
  top: { borderTopLeftRadius: 6, borderTopRightRadius: 6, paddingTop: 6 },
  foot: { marginBottom: 8, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, borderBottomWidth: 10, borderBottomColor: WOOD_FACE },
  upright: { position: "absolute", top: 0, bottom: 0, width: UPRIGHT, zIndex: 3 },
  // The shadow the plank above casts on the back panel
  shade: { position: "absolute", left: UPRIGHT, right: UPRIGHT, top: 0, height: 36 },
  row: { flexDirection: "row", gap: GAP },
  slot: { flex: 1 },
  deck: { height: 7, marginHorizontal: -INSET },
  rail: {
    height: 24, marginHorizontal: -INSET,
    shadowColor: "#000000", shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 4 },
  },
  // Stuck to the rail, hanging just below its edge
  stickers: { marginTop: -21, alignItems: "flex-start" },
  // On the pack's foot, at its right
  plusSpot: { position: "absolute", right: -2, bottom: 2 },
  sticker: {
    alignSelf: "center", width: "96%", paddingHorizontal: 5, paddingVertical: 3, borderRadius: 2, backgroundColor: "#fff8d6",
    shadowColor: "#0f172a", shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  struck: { fontFamily: fonts.medium, fontSize: 9.5, color: colors.textSecondary, textDecorationLine: "line-through" },
  name: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 15, color: colors.text },
  // Right of the price, giving way to it when the label is tight
  size: { flexShrink: 1, marginLeft: "auto", fontFamily: fonts.medium, fontSize: 9.5, color: colors.textSecondary },
  low: { fontFamily: fonts.extrabold, fontSize: 9.5, lineHeight: 12, color: "#c2410c" },
});
