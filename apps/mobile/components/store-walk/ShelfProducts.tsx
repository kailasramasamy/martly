import { useMemo, useRef } from "react";
import { StyleSheet, Text, View, type Image } from "react-native";
import { colors, festiveFonts, fonts } from "../../constants/theme";
import { cardDeal, useDealLabel } from "../../lib/deal";
import { groupByProduct } from "../../lib/group-variants";
import { useLanguage } from "../../lib/language-context";
import { useProductActions } from "../../lib/product-actions";
import { useStrings } from "../../lib/i18n/use-strings";
import type { StoreProduct } from "../../lib/types";
import { LOW_STOCK, Pack, PlusButton } from "./ShelfPack";

export const PER_SHELF = 3;
// Space between the shelf's sides and the packs
const INSET = 8;
const WOOD = "#c89b62";
const WOOD_FACE = "#b0824b";

// Each sticker sits a little askew, as if stuck on by hand
const TILTS = ["-2deg", "1.5deg", "-1deg"];

// The price sticker stuck on the shelf's front edge under a pack: the price written by hand against MRP, the deal,
// name and size, and how few are left when stock runs low
function Sticker({ item, variants, i }: { item: StoreProduct; variants: StoreProduct[]; i: number }) {
  const t = useStrings("catalog");
  const { getLocalizedName } = useLanguage();
  const { isMember } = useProductActions();
  const low = item.availableStock <= LOW_STOCK;
  const dealLabel = useDealLabel();
  const deal = cardDeal(item, isMember);
  const label = dealLabel(deal);
  return (
    <View style={[styles.sticker, { transform: [{ rotate: TILTS[i % TILTS.length] }] }]}>
      <View style={styles.tape} />
      <View style={styles.priceRow}>
        <Text style={styles.price}>{"\u20B9"}{Math.round(deal.shown)}</Text>
        {deal.struck != null && <Text style={styles.struck}>{"\u20B9"}{Math.round(deal.struck)}</Text>}
      </View>
      {label && <Text style={styles.deal}>{label}</Text>}
      <Text style={styles.name} numberOfLines={2}>{getLocalizedName(item.product)}</Text>
      <Text style={styles.size} numberOfLines={1}>{variants.length > 1 ? t.options(variants.length) : item.variant.name}</Text>
      {low && <Text style={styles.low}>{t.onlyLeft(item.availableStock)}</Text>}
    </View>
  );
}

/** One shelf: up to three packs standing on a wooden plank, each priced by a sticker stuck on the shelf's front edge */
// The + rides with the stickers, drawn after the plank: the packs' row stays under the wood, so their photos' white
// backgrounds multiply onto it
export function Shelf({ items, variantsOf }: { items: StoreProduct[]; variantsOf: Map<string, StoreProduct[]> }) {
  const { storeId } = useProductActions();
  const photos = useRef(new Map<string, Image | null>());
  const slots = [...items, ...Array(PER_SHELF - items.length).fill(null)] as (StoreProduct | null)[];
  const variants = (sp: StoreProduct) => variantsOf.get(sp.product.id) ?? [sp];
  return (
    <View style={styles.shelf}>
      <View style={[styles.row, styles.packs]}>
        {slots.map((sp, i) => (sp
          ? <Pack key={sp.id} item={sp} storeId={storeId} onPhoto={(photo) => photos.current.set(sp.id, photo)} />
          : <View key={i} style={styles.slot} />))}
      </View>
      <View style={styles.plank} />
      <View style={styles.lip} />
      <View style={[styles.row, styles.stickers]}>
        {slots.map((sp, i) => (sp ? (
          <View key={sp.id} style={styles.slot}>
            <Sticker item={sp} variants={variants(sp)} i={i} />
            <View style={styles.plusSpot}>
              <PlusButton item={sp} variants={variants(sp)} photo={() => photos.current.get(sp.id) ?? null} />
            </View>
          </View>
        ) : <View key={i} style={styles.slot} />))}
      </View>
    </View>
  );
}

/** The aisle's products as a shop shelf: rows of packs on planks, priced on tickets along each shelf's edge */
export function useShelves(products: StoreProduct[]) {
  return useMemo(() => {
    const { primary, variantsByProductId } = groupByProduct(products);
    const shelves: StoreProduct[][] = [];
    for (let i = 0; i < primary.length; i += PER_SHELF) shelves.push(primary.slice(i, i + PER_SHELF));
    return { shelves, variantsOf: variantsByProductId };
  }, [products]);
}

const styles = StyleSheet.create({
  // A white shelf (the packs' photos have white backgrounds)
  shelf: { marginBottom: 14, paddingTop: 12, paddingBottom: 10, paddingHorizontal: INSET, borderRadius: 12, backgroundColor: "#ffffff", overflow: "hidden" },
  row: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
  // Every pack stands on the plank, whatever its photo's height
  packs: { alignItems: "flex-end" },
  // The plank and its front edge run right across the shelf, side to side; the stickers are stuck to the front edge
  plank: { height: 6, marginTop: 2, marginHorizontal: -INSET, backgroundColor: WOOD },
  lip: { height: 22, marginHorizontal: -INSET, backgroundColor: WOOD_FACE },
  stickers: { marginTop: -18, alignItems: "flex-start" },
  slot: { flex: 1 },
  // Rests on the plank above the sticker's corner, clear of the pack's photo
  plusSpot: { position: "absolute", right: 0, top: -8 },
  sticker: { paddingHorizontal: 6, paddingTop: 7, paddingBottom: 6, gap: 1, borderRadius: 3, backgroundColor: "#fff8d6",
    borderWidth: 1, borderColor: "#f1e3a8",
    shadowColor: "#0f172a", shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  tape: {
    position: "absolute", top: -6, alignSelf: "center", width: 30, height: 11, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.75)", borderWidth: 1, borderColor: "rgba(148,163,184,0.35)", transform: [{ rotate: "-4deg" }],
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4, flexWrap: "wrap" },
  // In the shopkeeper's hand; Kalam reaches well above its em box, so the line is tall enough for its tops
  price: { fontFamily: festiveFonts.KALAM, fontSize: 19, lineHeight: 28, paddingTop: 2, color: "#1e3a8a" },
  struck: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textSecondary, textDecorationLine: "line-through" },
  deal: { fontFamily: fonts.extrabold, fontSize: 10, color: "#b91c1c" },
  name: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, color: colors.text },
  size: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textSecondary },
  low: { fontFamily: fonts.extrabold, fontSize: 10, color: "#c2410c" },
});
