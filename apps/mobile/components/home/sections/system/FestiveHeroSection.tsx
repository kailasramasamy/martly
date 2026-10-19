import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import type { SystemSection } from "@martly/shared/types";
import type { FestiveHero as FestiveHeroData, FestiveTile } from "../../../../lib/types";
import { FestiveHero } from "../../FestiveHero";
import { useHomeSectionEnv } from "../context";

const SCREEN_WIDTH = Dimensions.get("window").width;
const ROTATE_MS = 5000;

interface SlideProps {
  hero: FestiveHeroData;
  backdrop: { top: number } | null;
  onOpen: () => void;
}

// Each slide is painted in its festival's colour, so a shorter grid still fills the carousel's height
const Slide = memo(function Slide({ hero, backdrop, onOpen }: SlideProps) {
  const onTile = useCallback((tile: FestiveTile) => {
    onOpen();
    router.push({ pathname: "/festival/[id]", params: { id: hero.id, tile: tile.id } });
  }, [hero.id, onOpen]);
  return (
    <View style={[styles.slide, { backgroundColor: hero.theme.background }]}>
      <FestiveHero hero={hero} onTile={onTile} backdrop={backdrop} />
    </View>
  );
});

function Dots({ count, active, ink }: { count: number; active: number; ink: string }) {
  return (
    <View style={styles.dots} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: ink }, i === active ? styles.dotActive : styles.dotIdle]} />
      ))}
    </View>
  );
}

/**
 * Advances every few seconds while the hero is on screen and Home is in front, until the shopper swipes or opens a
 * tile. The first slide is repeated at the end, so the loop always runs forward: landing on the repeat jumps back to
 * the real first slide unseen.
 */
function useAutoAdvance(count: number) {
  const { heroInView } = useHomeSectionEnv();
  const focused = useIsFocused();
  const listRef = useRef<FlatList<FestiveHeroData>>(null);
  const [position, setPosition] = useState(0);
  const [stopped, setStopped] = useState(false);
  const stop = useCallback(() => setStopped(true), []);

  useEffect(() => {
    if (count < 2 || stopped || !focused || !heroInView) return undefined;
    const timer = setTimeout(
      () => listRef.current?.scrollToOffset({ offset: (position + 1) * SCREEN_WIDTH, animated: true }),
      ROTATE_MS,
    );
    return () => clearTimeout(timer);
  }, [count, stopped, focused, heroInView, position]);

  // The header switches as the next slide passes halfway, while it is still moving
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (x >= count * SCREEN_WIDTH - 1) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      setPosition(0);
      return;
    }
    setPosition(Math.round(x / SCREEN_WIDTH));
  }, [count]);

  return { listRef, active: position % count, onScroll, stop };
}

/** Festivals live at once share the top of Home as a looping carousel; the header takes the colours of the one in view */
export const FestiveHeroSection = memo(function FestiveHeroSection({ section }: { section: SystemSection }) {
  const heroes = section.data.heroes as FestiveHeroData[];
  const { backdrop, onFestiveTheme } = useHomeSectionEnv();
  const { listRef, active, onScroll, stop } = useAutoAdvance(heroes.length);
  const current = heroes[Math.min(active, heroes.length - 1)];
  useEffect(() => onFestiveTheme(current.theme), [current, onFestiveTheme]);

  if (heroes.length === 1) return <Slide hero={current} backdrop={backdrop} onOpen={stop} />;
  return (
    <View>
      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        data={[...heroes, heroes[0]]}
        keyExtractor={(hero, i) => `${hero.id}-${i}`}
        renderItem={({ item }) => <Slide hero={item} backdrop={backdrop} onOpen={stop} />}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onScrollBeginDrag={stop}
        scrollEventThrottle={16}
      />
      <Dots count={heroes.length} active={active} ink={current.theme.title} />
    </View>
  );
});

const styles = StyleSheet.create({
  slide: { width: SCREEN_WIDTH },
  dots: { position: "absolute", bottom: 6, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 18 },
  dotIdle: { width: 6, opacity: 0.35 },
});
