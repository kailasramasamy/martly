import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { cardDeal, useDealLabel } from "../../lib/deal";
import { useProductActions } from "../../lib/product-actions";
import { useStrings } from "../../lib/i18n/use-strings";
import { useReduceMotion } from "../../lib/use-reduce-motion";
import type { WalkPack } from "../../lib/types";

/** `play`: the shelf has come into view. `animate`: this pack is one of the shelf's two that move; the rest stand still */
export interface Motion { play: boolean; animate: boolean }

/**
 * 0 → 1 once, the first time the shelf comes into view. A pack that won't move (Reduce Motion, or past the shelf's two)
 * starts at 1, its resting state
 */
export function usePlayOnce({ play, animate }: Motion, duration: number, delay = 0) {
  const reduce = useReduceMotion();
  const live = animate && !reduce;
  const value = useRef(new Animated.Value(live ? 0 : 1)).current;
  const played = useRef(false);
  useEffect(() => {
    if (!live || !play || played.current) return;
    played.current = true;
    Animated.timing(value, { toValue: 1, duration, delay, easing: Easing.linear, useNativeDriver: true }).start();
  }, [live, play, value, duration, delay]);
  return value;
}

// Keyframes for a value running 0 → 1: evenly spaced, like a CSS animation's steps
export const frames = (value: Animated.Value, steps: (number | string)[]) =>
  value.interpolate({ inputRange: steps.map((_, i) => i / (steps.length - 1)), outputRange: steps as number[] | string[] });

/** The red flag for a buy-X-get-Y or a big saving; it flutters twice, as if a fan caught it */
export function OfferFlag({ item, motion }: { item: WalkPack; motion: Motion }) {
  const tc = useStrings("common");
  const { isMember } = useProductActions();
  const dealLabel = useDealLabel();
  const t = usePlayOnce(motion, 2400, 300);
  const offer = item.pricing?.offer;
  const deal = cardDeal(item, isMember);
  const text = offer ? tc.buyGet(offer.buy, offer.get) : deal.highlight ? dealLabel(deal) : null;
  if (!text) return null;
  const rotate = frames(t, ["-10deg", "-17deg", "-5deg", "-15deg", "-7deg", "-13deg", "-6deg", "-12deg", "-8deg", "-10deg"]);
  return (
    <Animated.View style={[styles.tag, styles.flag, { transform: [{ rotate }] }]} pointerEvents="none">
      <Text style={styles.flagText} numberOfLines={2}>{text}</Text>
    </Animated.View>
  );
}

/** The aisle's bestseller: a gold tag pops on */
export function BestsellerTag({ motion, raised }: { motion: Motion; raised: boolean }) {
  const t = useStrings("catalog");
  const v = usePlayOnce(motion, 420, 200);
  const scale = frames(v, [0, 1.25, 1]);
  return (
    <Animated.View style={[styles.tag, styles.bestseller, raised && styles.lower, { transform: [{ scale }, { rotate: "-8deg" }] }]} pointerEvents="none">
      <Ionicons name="star" size={10} color="#422006" />
      <Text style={styles.bestsellerText}>{t.bestsellerBadge}</Text>
    </Animated.View>
  );
}

/** A light sweeping across the bestseller's pack, twice */
export function Shine({ motion, width }: { motion: Motion; width: number }) {
  const v = usePlayOnce(motion, 1800, 400);
  const sweep = frames(v, [-50, width + 10, -50, width + 10]);
  return (
    <Animated.View pointerEvents="none" style={[styles.shine, { transform: [{ translateX: sweep }, { skewX: "-14deg" }] }]} />
  );
}

/** The owner's pick hangs from a string and swings to rest */
export function OwnerTalker({ motion }: { motion: Motion }) {
  const t = useStrings("storeVoice");
  const v = usePlayOnce(motion, 1500, 300);
  const rotate = frames(v, ["22deg", "-14deg", "9deg", "-5deg", "2deg", "0deg"]);
  return (
    <Animated.View style={[styles.hanger, { transform: [{ translateY: -12 }, { rotate }, { translateY: 12 }] }]} pointerEvents="none">
      <View style={styles.string} />
      <View style={[styles.tag, styles.talker]}>
        <Text style={styles.talkerText} numberOfLines={2}>{t.ownersPick}</Text>
      </View>
    </Animated.View>
  );
}

// Each tag stacked above on the pack's left pushes this one down
const TAG_STEP = 34;

/** How many shoppers bought it here this week, rising in under the pack's other tags */
export function TrendingTag({ count, motion, under }: { count: number; motion: Motion; under: number }) {
  const t = useStrings("storeWalk");
  const v = usePlayOnce(motion, 600, 400);
  const style = { opacity: frames(v, [0, 1, 1]), transform: [{ translateY: frames(v, [14, -3, 0]) }] };
  return (
    <Animated.View style={[styles.tag, styles.trending, { top: 4 + TAG_STEP * under }, style]} pointerEvents="none">
      <Ionicons name="trending-up" size={11} color="#ea580c" />
      <Text style={styles.trendingText}>{t.thisWeek(count)}</Text>
    </Animated.View>
  );
}

/** New on these shelves: a starburst pops on */
export function NewBurst({ motion }: { motion: Motion }) {
  const t = useStrings("storeWalk");
  const v = usePlayOnce(motion, 420, 200);
  const style = { transform: [{ scale: frames(v, [0, 1.25, 1]) }, { rotate: frames(v, ["-30deg", "-4deg", "-8deg"]) }] };
  return (
    <Animated.View style={[styles.burst, style]} pointerEvents="none">
      <View style={[styles.burstPoint, { transform: [{ rotate: "45deg" }] }]} />
      <View style={styles.burstPoint} />
      <Text style={styles.burstText}>{t.newTag}</Text>
    </Animated.View>
  );
}

const shadow = { shadowColor: "#000000", shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 };

const styles = StyleSheet.create({
  tag: { position: "absolute", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, ...shadow },
  flag: { left: -4, top: 4, maxWidth: 66, backgroundColor: "#dc2626", transformOrigin: "left center" },
  flagText: { fontFamily: fonts.extrabold, fontSize: 10, lineHeight: 12, color: "#ffffff", textAlign: "center" },
  bestseller: { left: -4, top: 4, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#f59e0b" },
  // Under the offer flag when the pack has both
  lower: { top: 4 + TAG_STEP },
  bestsellerText: { fontFamily: fonts.extrabold, fontSize: 10, lineHeight: 12, color: "#422006" },
  shine: { position: "absolute", top: 0, bottom: 0, left: 0, width: 34, backgroundColor: "rgba(255,255,255,0.4)" },
  hanger: { position: "absolute", right: 2, top: -4, alignItems: "center" },
  string: { width: 1.5, height: 10, backgroundColor: "#cbd5e1" },
  talker: { position: "relative", maxWidth: 60, backgroundColor: colors.primary },
  talkerText: { fontFamily: fonts.extrabold, fontSize: 10, lineHeight: 12, color: "#ffffff", textAlign: "center" },
  trending: { left: -4, flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 10, backgroundColor: "#ffffff" },
  trendingText: { fontFamily: fonts.extrabold, fontSize: 10, lineHeight: 12, color: "#9a3412" },
  burst: { position: "absolute", right: 2, top: 2, width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  burstPoint: { position: "absolute", width: 28, height: 28, borderRadius: 3, backgroundColor: colors.accent },
  burstText: { fontFamily: fonts.extrabold, fontSize: 10, color: colors.accentText },
});
