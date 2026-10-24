import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, StyleSheet, View, type FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";
import type { HeroCard, HeroCardsSection as HeroCards } from "@martly/shared/types";
import { colors } from "../../../constants/theme";
import type { StoreProduct } from "../../../lib/types";
import { useHomeSectionEnv } from "../sections/context";
import { HeroCardBody } from "./cards";
import { HERO_CARD_GAP, HERO_CARD_WIDTH } from "./HeroCardFrame";
import { heroHeaderTheme } from "./hero-theme";

type Card = HeroCard<StoreProduct>;

const SCREEN_WIDTH = Dimensions.get("window").width;
const INTERVAL = HERO_CARD_WIDTH + HERO_CARD_GAP;
// The first card lines up with the page's 16px edge; the next one peeks in on the right
const EDGE = 16;
const ROTATE_MS = 5000;
// Under the header when it sits above the list rather than over this section
const MIN_TOP = 12;

/** Each card's wash, stacked in order: a card's layer fades in over the previous one as it slides into view */
function Washes({ cards, scrollX }: { cards: Card[]; scrollX: Animated.Value }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cards.map((card, i) => (
        <Animated.View
          key={card.id}
          style={[StyleSheet.absoluteFill, i > 0 && {
            opacity: scrollX.interpolate({ inputRange: [(i - 1) * INTERVAL, i * INTERVAL], outputRange: [0, 1], extrapolate: "clamp" }),
          }]}
        >
          <LinearGradient colors={[card.theme.tint, card.theme.tintSoft, colors.surface]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ))}
    </View>
  );
}

function Dots({ count, active, ink }: { count: number; active: number; ink: string }) {
  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: ink }, i === active ? styles.dotActive : styles.dotIdle]} />
      ))}
    </View>
  );
}

/** Moves to the next card every few seconds while the hero is on screen and Home is in front, until the shopper swipes */
function useAutoAdvance(count: number) {
  const { heroInView } = useHomeSectionEnv();
  const focused = useIsFocused();
  const listRef = useRef<FlatList<Card>>(null);
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState(false);
  const stop = useCallback(() => setStopped(true), []);

  useEffect(() => {
    if (count < 2 || stopped || !focused || !heroInView) return undefined;
    const timer = setTimeout(() => listRef.current?.scrollToOffset({ offset: ((active + 1) % count) * INTERVAL, animated: true }), ROTATE_MS);
    return () => clearTimeout(timer);
  }, [count, stopped, focused, heroInView, active]);

  // The header switches as the next card passes halfway, while it is still moving
  const onPosition = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.min(count - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / INTERVAL)));
    setActive((current) => (current === next ? current : next));
  }, [count]);

  return { listRef, active, onPosition, stop };
}

/** Tall cards leading Home, swiped sideways; the wash behind the header and the header's ink follow the card in view */
export const HeroCardsSection = memo(function HeroCardsSection({ section }: { section: HeroCards<StoreProduct> }) {
  const { cards } = section;
  const env = useHomeSectionEnv();
  // Only when leading Home does the section run up behind the header and colour it
  const leads = env.leadId === section.id;
  const backdrop = leads ? env.backdrop : null;
  const { onFestiveTheme } = env;
  const scrollX = useRef(new Animated.Value(0)).current;
  const { listRef, active, onPosition, stop } = useAutoAdvance(cards.length);
  const current = cards[active];
  useEffect(() => {
    if (leads) onFestiveTheme(heroHeaderTheme(current.theme));
  }, [leads, current, onFestiveTheme]);
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true, listener: onPosition }),
    [scrollX, onPosition],
  );

  return (
    <View style={{ paddingTop: backdrop ? backdrop.top + 4 : MIN_TOP }}>
      <Washes cards={cards} scrollX={scrollX} />
      <Animated.FlatList
        ref={listRef}
        horizontal
        data={cards}
        keyExtractor={(card) => card.id}
        renderItem={({ item }) => <HeroCardBody card={item} />}
        ItemSeparatorComponent={Gap}
        snapToInterval={INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={styles.rail}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onScrollBeginDrag={stop}
        scrollEventThrottle={16}
      />
      <Dots count={cards.length} active={active} ink={current.theme.ink} />
    </View>
  );
});

const Gap = () => <View style={styles.gap} />;

const styles = StyleSheet.create({
  // Room after the last card so it too can come to rest at the left edge, its wash fully in
  rail: { paddingLeft: EDGE, paddingRight: SCREEN_WIDTH - EDGE - HERO_CARD_WIDTH },
  gap: { width: HERO_CARD_GAP },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 12, paddingBottom: 4 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 18 },
  dotIdle: { width: 6, opacity: 0.3 },
});
