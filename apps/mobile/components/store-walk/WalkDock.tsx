import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../constants/theme";
import { useCart } from "../../lib/cart-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { useFly } from "./basket-fly";
import { useCountUp } from "./motion";
import { useReduceMotion } from "../../lib/use-reduce-motion";
import { AISLE } from "./aisle-theme";
import { carriesTrolley } from "./cart-look";

const IN_CART = 3;

// A basket, or a trolley once the cart outgrows it, with the latest cut-out packs peeking over its rim; packs added on the shelves fly into it
function Carrier({ photos, scale, trolley }: { photos: string[]; scale: Animated.AnimatedInterpolation<number>; trolley: boolean }) {
  const flyer = useFly();
  return (
    <Animated.View ref={flyer?.basketRef} collapsable={false} style={[styles.basket, { transform: [{ scale }] }]}>
      <View style={styles.peek}>
        {photos.slice(-IN_CART).map((uri, i) => (
          <Image key={`${uri}-${i}`} source={{ uri }} style={[styles.peekPack, { transform: [{ rotate: `${(i - 1) * 12}deg` }] }]} />
        ))}
      </View>
      <Ionicons name={trolley ? "cart" : "basket"} size={trolley ? 30 : 26} color={AISLE.accent} />
    </Animated.View>
  );
}

// Each time the bag total goes up: the bag bounces and a "+₹N" chip floats up from it
function useBagBump(total: number) {
  const reduce = useReduceMotion();
  const last = useRef(total);
  const bump = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(1)).current;
  const [gain, setGain] = useState(0);
  useEffect(() => {
    const diff = total - last.current;
    last.current = total;
    if (diff <= 0 || reduce) return;
    setGain(diff);
    bump.setValue(0);
    float.setValue(0);
    Animated.parallel([
      Animated.spring(bump, { toValue: 1, velocity: 8, stiffness: 260, damping: 9, useNativeDriver: true }),
      Animated.timing(float, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => bump.setValue(0));
  }, [total, reduce, bump, float]);
  const scale = bump.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.35, 1] });
  const chip = {
    opacity: float.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
    transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) }],
  };
  return { scale, chip, gain };
}

interface Props {
  /** The next aisle; null on the department's last one */
  next: { name: string; imageUrl: string | null } | null;
  /** End the walk and see what it put in the bag */
  onBag: () => void;
  onNext: () => void;
  /** The walk fills the monthly list: the bar shows the list, and the bag button goes back to it */
  forList: boolean;
}

/** The walk's bottom bar, one row: the cart (its count and total; tap to see it) and the next aisle */
export function WalkDock({ next, onBag, onNext, forList }: Props) {
  const t = useStrings("storeWalk");
  const insets = useSafeAreaInsets();
  const { items, itemCount, totalAmount } = useCart();
  const shownTotal = useCountUp(Math.round(totalAmount));
  const { scale, chip, gain } = useBagBump(Math.round(totalAmount));
  return (
    // Android's navigation bar scrim washes out anything inside it, so the buttons clear it there
    <View style={[styles.dock, { paddingBottom: Platform.OS === "android" ? insets.bottom + 8 : Math.max(8, insets.bottom - 16) }]}>
      <TouchableOpacity style={[styles.button, styles.bag]} onPress={onBag} activeOpacity={0.8} accessibilityRole="button">
        <Carrier photos={items.flatMap((i) => i.cutoutUrl ?? [])} scale={scale} trolley={carriesTrolley(items)} />
        <View style={styles.bagWords}>
          <Text style={styles.bagButtonText} numberOfLines={1}>{forList ? t.backToList : t.seeMyBag}</Text>
          <Text style={styles.bagText} numberOfLines={1}>{(forList ? t.onList : t.bag)(itemCount, shownTotal.toLocaleString("en-IN"))}</Text>
        </View>
        <Animated.View pointerEvents="none" style={[styles.chip, chip]}>
          <Text style={styles.chipText}>+{"\u20B9"}{gain.toLocaleString("en-IN")}</Text>
        </Animated.View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.next]} onPress={onNext} activeOpacity={0.85} accessibilityRole="button"
        accessibilityLabel={next ? t.nextAisle(next.name) : t.lastAisle}
      >
        {next?.imageUrl && <View style={styles.nextPicture}><Image source={{ uri: next.imageUrl }} style={styles.nextImage} /></View>}
        <View style={styles.nextTextWrap}>
          {next && <Text style={styles.nextKicker}>{t.nextKicker}</Text>}
          <Text style={styles.nextText} numberOfLines={1}>{next ? next.name : t.lastAisle}</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    flexDirection: "row", gap: 10, paddingTop: 8, paddingHorizontal: 16, backgroundColor: AISLE.panel,
    borderTopWidth: 1, borderTopColor: AISLE.line,
  },
  basket: { width: 36, height: 36, alignItems: "center", justifyContent: "flex-end" },
  // The packs sit behind the basket's front, showing over its rim
  peek: { position: "absolute", top: 0, flexDirection: "row", zIndex: -1 },
  peekPack: { width: 16, height: 16, marginHorizontal: -3, resizeMode: "contain" },
  bagWords: { flex: 1 },
  bagText: { fontFamily: fonts.semibold, fontSize: 12, color: AISLE.muted },
  chip: { position: "absolute", left: 8, top: -10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.extrabold, fontSize: 12, color: "#ffffff" },
  button: { minHeight: 52, paddingVertical: 4, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
  bag: { flex: 1, borderWidth: 1.5, borderColor: AISLE.line },
  bagButtonText: { fontFamily: fonts.extrabold, fontSize: 14, color: AISLE.text },
  next: { flex: 1.2, backgroundColor: colors.primary, paddingLeft: 6 },
  nextPicture: { width: 38, height: 38, borderRadius: 9, backgroundColor: "#ffffff", padding: 3 },
  nextImage: { flex: 1, resizeMode: "contain" },
  nextTextWrap: { flex: 1 },
  nextKicker: { fontFamily: fonts.bold, fontSize: 12, color: "#99f6e4" },
  nextText: { fontFamily: fonts.extrabold, fontSize: 14, lineHeight: 18, color: "#ffffff" },
});
