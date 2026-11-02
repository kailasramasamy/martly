import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../constants/theme";
import { cardDeal, useDealLabel } from "../../lib/deal";
import { useLanguage } from "../../lib/language-context";
import { useProductActions } from "../../lib/product-actions";
import { useStrings } from "../../lib/i18n/use-strings";
import { useReduceMotion } from "../../lib/use-reduce-motion";
import type { StoreProduct, WalkPack } from "../../lib/types";
import { ShelfPrice } from "./ShelfPrice";
import { HeldPack, type Side } from "./HeldPack";
import { cutoutOf, photoOf } from "./ShelfPack";

export interface Lifted { item: WalkPack; variants: StoreProduct[] }

// Lifting: the pack rises off the shelf, grows in the hand, upright so it can be turned, and the sheet slides up under it
function useLift() {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!reduce) Animated.spring(v, { toValue: 1, stiffness: 180, damping: 16, mass: 0.9, useNativeDriver: true }).start();
  }, [v, reduce]);
  return {
    pack: {
      opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
      transform: [
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [160, 0] }) },
        { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
      ],
    },
    sheet: { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] },
  };
}

// The pack's sizes as chips: each its price, in the shopkeeper's hand, against MRP, and how many are in the bag
function Sizes({ variants, picked, onPick }: { variants: StoreProduct[]; picked: string; onPick: (id: string) => void }) {
  const { isMember, cartQuantityMap } = useProductActions();
  return (
    <FlatList
      horizontal data={variants} keyExtractor={(v) => v.id} showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.sizes}
      renderItem={({ item: v }) => {
        const deal = cardDeal(v, isMember);
        const on = v.id === picked;
        const count = cartQuantityMap.get(v.id) ?? 0;
        return (
          <TouchableOpacity style={[styles.size, on && styles.sizeOn]} onPress={() => onPick(v.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
            <Text style={styles.sizeName} numberOfLines={1}>{v.variant.name}</Text>
            <ShelfPrice amount={deal.shown} size={20} />
            {deal.struck != null && <Text style={styles.sizeStruck}>{"\u20B9"}{Math.round(deal.struck)}</Text>}
            {count > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{count}</Text></View>}
          </TouchableOpacity>
        );
      }}
    />
  );
}

// A pack in one size: its size and price, in the shopkeeper's hand, against MRP with the saving
function PriceLine({ sp }: { sp: StoreProduct }) {
  const { isMember } = useProductActions();
  const dealLabel = useDealLabel();
  const deal = cardDeal(sp, isMember);
  const label = dealLabel(deal);
  return (
    <View style={styles.priceLine}>
      <Text style={styles.lineSize}>{sp.variant.name}</Text>
      <ShelfPrice amount={deal.shown} size={28} />
      {deal.struck != null && <Text style={styles.lineStruck}>{"\u20B9"}{Math.round(deal.struck)}</Text>}
      {label && <View style={styles.saving}><Text style={styles.savingText}>{label}</Text></View>}
    </View>
  );
}

// Add for the picked size; once it's in the bag, − n + in its place
function AddPicked({ sp }: { sp: StoreProduct }) {
  const t = useStrings("storeWalk");
  const { addToCart, updateQuantity, isMember, cartQuantityMap } = useProductActions();
  const count = cartQuantityMap.get(sp.id) ?? 0;
  if (count === 0) {
    return (
      <TouchableOpacity style={[styles.button, styles.primary]} onPress={() => addToCart(sp)} accessibilityRole="button">
        <Text style={styles.primaryText}>{t.addSize(sp.variant.name, String(Math.round(cardDeal(sp, isMember).shown)))}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.button, styles.primary, styles.stepper]}>
      <TouchableOpacity style={styles.step} onPress={() => updateQuantity(sp.id, count - 1)} accessibilityRole="button" accessibilityLabel="−">
        <Ionicons name="remove" size={22} color="#ffffff" />
      </TouchableOpacity>
      <View style={styles.stepMiddle}>
        <Text style={styles.stepCount}>{count}</Text>
        <Text style={styles.stepNote}>{t.inBag}</Text>
      </View>
      <TouchableOpacity style={styles.step} onPress={() => addToCart(sp)} accessibilityRole="button" accessibilityLabel="+">
        <Ionicons name="add" size={22} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

function Sheet({ item, variants, aisle, onClose }: Lifted & { aisle: string; onClose: () => void }) {
  const t = useStrings("storeWalk");
  const insets = useSafeAreaInsets();
  const { getLocalizedName } = useLanguage();
  const { storeId } = useProductActions();
  const [picked, setPicked] = useState(item.id);
  const sp = variants.find((v) => v.id === picked) ?? item;
  const details = () => {
    onClose();
    router.push({ pathname: "/product/[id]", params: storeId ? { id: item.product.id, storeId } : { id: item.product.id } });
  };
  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom) }]}>
      <View style={styles.handle} />
      {item.product.brand && <Text style={styles.brand}>{item.product.brand.name}</Text>}
      <Text style={styles.name}>{getLocalizedName(item.product)}</Text>
      {item.shelf.bestseller && (
        <View style={styles.chip}><Ionicons name="star" size={11} color="#92400e" /><Text style={styles.chipText}>{t.bestsellerIn(aisle)}</Text></View>
      )}
      {variants.length > 1 ? <Sizes variants={variants} picked={picked} onPick={setPicked} /> : <PriceLine sp={sp} />}
      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={details} accessibilityRole="button">
          <Text style={styles.secondaryText}>{t.viewDetails}</Text>
        </TouchableOpacity>
        <AddPicked sp={sp} />
      </View>
    </View>
  );
}

/**
 * A pack picked up off the shelf: held up over the dimmed aisle, to turn over and pinch to look closer, with its sizes and
 * Add on a sheet below. Tap the aisle to put it back
 */
export function PackQuickView({ lifted, aisle, onClose }: { lifted: Lifted | null; aisle: string; onClose: () => void }) {
  return (
    <Modal visible={!!lifted} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {lifted && <Held lifted={lifted} aisle={aisle} onClose={onClose} />}
    </Modal>
  );
}

// Room under the held pack for its dots
const DOTS = 28;

// The pack's sides to turn through: its cut-out (or photo) first, then the product's other photos
function useSides(item: WalkPack): Side[] {
  return useMemo(() => {
    const cut = cutoutOf(item);
    const front = photoOf(item);
    const rest = (item.product.images ?? []).filter((uri) => uri !== front);
    return [{ uri: cut ?? front ?? "", cut: !!cut }, ...rest.map((uri) => ({ uri, cut: false }))];
  }, [item]);
}

function Held({ lifted, aisle, onClose }: { lifted: Lifted; aisle: string; onClose: () => void }) {
  const t = useStrings("storeWalk");
  const insets = useSafeAreaInsets();
  const motion = useLift();
  const [room, setRoom] = useState<{ width: number; height: number } | null>(null);
  const [sheet, setSheet] = useState(0);
  const sides = useSides(lifted.item);
  const dots = sides.length > 1 ? DOTS : 0;
  const box = room && { width: Math.min(room.width * 0.68, room.height * 0.72), height: room.height * 0.86 - dots };
  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.putBack} />
      <Animated.View style={motion.sheet} onLayout={(e) => setSheet(e.nativeEvent.layout.height)}>
        <Sheet {...lifted} aisle={aisle} onClose={onClose} />
      </Animated.View>
      {/* The room above the sheet, the pack held in the middle of it; after the sheet so a zoomed pack draws over it */}
      <View
        style={[styles.room, { top: insets.top + 12, bottom: sheet + 12 }]} pointerEvents="box-none"
        onLayout={(e) => setRoom(e.nativeEvent.layout)}
      >
        {box && sheet > 0 && (
          <Animated.View style={motion.pack}>
            <HeldPack sides={sides} width={box.width} height={box.height} />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.6)" },
  room: { position: "absolute", left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  sheet: { paddingHorizontal: 16, paddingTop: 10, gap: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.surface },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#cbd5e1" },
  brand: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: -6 },
  name: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 23, color: colors.text },
  chip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: "#fef3c7" },
  chipText: { fontFamily: fonts.extrabold, fontSize: 11, color: "#92400e" },
  sizes: { gap: 8, paddingTop: 6, paddingRight: 4 },
  size: {
    minWidth: 96, paddingHorizontal: 14, paddingVertical: 10, gap: 2, borderRadius: 12, borderWidth: 1.5,
    borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  sizeOn: { borderWidth: 2, borderColor: colors.primary, backgroundColor: "#f0fdfa" },
  sizeName: { fontFamily: fonts.bold, fontSize: 13, color: "#334155" },
  sizeStruck: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, textDecorationLine: "line-through" },
  priceLine: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 10 },
  lineSize: { fontFamily: fonts.bold, fontSize: 15, color: "#334155" },
  lineStruck: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textDecorationLine: "line-through" },
  saving: { alignSelf: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.salePill },
  savingText: { fontFamily: fonts.extrabold, fontSize: 12, color: colors.salePillText },
  badge: {
    position: "absolute", top: -7, right: -7, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderWidth: 1.5, borderColor: "#ffffff",
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 11, color: "#ffffff" },
  stepper: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
  step: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  stepMiddle: { alignItems: "center" },
  stepCount: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 20, color: "#ffffff" },
  stepNote: { fontFamily: fonts.semibold, fontSize: 11, color: "rgba(255,255,255,0.85)" },
  buttons: { flexDirection: "row", gap: 10, marginTop: 4 },
  button: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  secondary: { flex: 1, borderWidth: 1.5, borderColor: "#cbd5e1" },
  secondaryText: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text },
  primary: { flex: 1.4, backgroundColor: colors.primary },
  primaryText: { fontFamily: fonts.extrabold, fontSize: 15, color: "#ffffff" },
});
