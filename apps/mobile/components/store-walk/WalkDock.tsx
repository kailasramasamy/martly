import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../constants/theme";
import { useCart } from "../../lib/cart-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { useFly } from "./basket-fly";
import { useCountUp } from "./motion";
import { useReduceMotion } from "../../lib/use-reduce-motion";

const IN_BASKET = 3;

// A wire basket with the latest packs peeking over its rim; packs added on the shelves fly into it
function Basket({ photos, scale }: { photos: string[]; scale: Animated.AnimatedInterpolation<number> }) {
  const flyer = useFly();
  return (
    <Animated.View ref={flyer?.basketRef} collapsable={false} style={[styles.basket, { transform: [{ scale }] }]}>
      <View style={styles.peek}>
        {photos.slice(-IN_BASKET).map((uri, i) => (
          <Image key={`${uri}-${i}`} source={{ uri }} style={[styles.peekPack, { transform: [{ rotate: `${(i - 1) * 12}deg` }] }]} />
        ))}
      </View>
      <Ionicons name="basket" size={26} color={colors.primary} />
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
  addedHere: number;
  /** Photos of what this walk added, oldest first */
  basket: string[];
  /** The next aisle; null on the department's last one */
  next: { name: string; imageUrl: string | null } | null;
  /** End the walk and see what it put in the bag */
  onBag: () => void;
  onNext: () => void;
  /** Leave the walk for the cart */
  onCart: () => void;
  /** The walk fills the monthly list: the bar shows the list, and both bag buttons go back to it */
  forList: boolean;
}

/** The walk's bottom bar: what's in the bag (tap it for the cart), then "See my bag" and the next aisle */
export function WalkDock({ addedHere, basket, next, onBag, onNext, onCart, forList }: Props) {
  const t = useStrings("storeWalk");
  const insets = useSafeAreaInsets();
  const { itemCount, totalAmount } = useCart();
  const shownTotal = useCountUp(Math.round(totalAmount));
  const { scale, chip, gain } = useBagBump(Math.round(totalAmount));
  return (
    <View style={[styles.dock, { paddingBottom: Math.max(10, insets.bottom - 14) }]}>
      <TouchableOpacity style={styles.bagRow} onPress={onCart} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={forList ? t.backToList : t.goToBag}>
        <Basket photos={basket} scale={scale} />
        <Text style={styles.bagText}>{(forList ? t.onList : t.bag)(itemCount, shownTotal.toLocaleString("en-IN"))}</Text>
        {addedHere > 0 && <Text style={styles.addedHere}>{t.addedHere(addedHere)}</Text>}
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        <Animated.View pointerEvents="none" style={[styles.chip, chip]}>
          <Text style={styles.chipText}>+{"₹"}{gain.toLocaleString("en-IN")}</Text>
        </Animated.View>
      </TouchableOpacity>
      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.button, styles.bag]} onPress={onBag} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.bagButtonText} numberOfLines={2}>{forList ? t.backToList : t.seeMyBag}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.next]} onPress={onNext} activeOpacity={0.85} accessibilityRole="button"
          accessibilityLabel={next ? t.nextAisle(next.name) : t.lastAisle}
        >
          {next?.imageUrl && <View style={styles.nextPicture}><Image source={{ uri: next.imageUrl }} style={styles.nextImage} /></View>}
          <View style={styles.nextTextWrap}>
            {next && <Text style={styles.nextKicker}>{t.nextKicker}</Text>}
            <Text style={styles.nextText} numberOfLines={2}>{next ? next.name : t.lastAisle}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { paddingTop: 10, paddingHorizontal: 16, gap: 10, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  bagRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  basket: { width: 44, height: 40, alignItems: "center", justifyContent: "flex-end" },
  // The packs sit behind the basket's front, showing over its rim
  peek: { position: "absolute", top: 0, flexDirection: "row", zIndex: -1 },
  peekPack: { width: 18, height: 18, marginHorizontal: -3, borderRadius: 4, backgroundColor: "#ffffff", resizeMode: "contain" },
  bagText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  addedHere: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  chip: { position: "absolute", left: 4, top: -6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.extrabold, fontSize: 12, color: "#ffffff" },
  buttons: { flexDirection: "row", gap: 10 },
  button: { minHeight: 56, paddingVertical: 6, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  bag: { flex: 1, borderWidth: 1.5, borderColor: "#cbd5e1", backgroundColor: colors.background },
  bagButtonText: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text, textAlign: "center" },
  next: { flex: 1.5, backgroundColor: colors.primary, paddingLeft: 6 },
  nextPicture: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#ffffff", padding: 3 },
  nextImage: { flex: 1, resizeMode: "contain" },
  nextTextWrap: { flex: 1 },
  nextKicker: { fontFamily: fonts.bold, fontSize: 13, color: "#99f6e4" },
  nextText: { fontFamily: fonts.extrabold, fontSize: 15, lineHeight: 20, color: "#ffffff" },
});
