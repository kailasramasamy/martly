import { memo, useCallback, useEffect, useState } from "react";
import { Dimensions, FlatList, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { router } from "expo-router";
import type { SystemSection } from "@martly/shared/types";
import type { FestiveHero as FestiveHeroData, FestiveTile } from "../../../../lib/types";
import { FestiveHero } from "../../FestiveHero";
import { useHomeSectionEnv } from "../context";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface SlideProps {
  hero: FestiveHeroData;
  backdrop: { top: number } | null;
}

// Each slide is painted in its festival's colour, so a shorter grid still fills the carousel's height
const Slide = memo(function Slide({ hero, backdrop }: SlideProps) {
  const onTile = useCallback(
    (tile: FestiveTile) => router.push({ pathname: "/festival/[id]", params: { id: hero.id, tile: tile.id } }),
    [hero.id],
  );
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

/** Festivals live at once share the top of Home as swipeable heroes; the header takes the colours of the one in view */
export const FestiveHeroSection = memo(function FestiveHeroSection({ section }: { section: SystemSection }) {
  const heroes = section.data.heroes as FestiveHeroData[];
  const { backdrop, onFestiveTheme } = useHomeSectionEnv();
  const [active, setActive] = useState(0);
  const current = heroes[Math.min(active, heroes.length - 1)];
  useEffect(() => onFestiveTheme(current.theme), [current, onFestiveTheme]);
  // The header switches as the next slide passes halfway, while the finger is still moving
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => setActive(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)),
    [],
  );

  if (heroes.length === 1) return <Slide hero={current} backdrop={backdrop} />;
  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        data={heroes}
        keyExtractor={(hero) => hero.id}
        renderItem={({ item }) => <Slide hero={item} backdrop={backdrop} />}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
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
