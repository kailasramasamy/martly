import { memo, useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Dimensions, StyleSheet } from "react-native";
import { HeroBannerSlide } from "../HeroBannerSlide";
import { colors, fonts } from "../../constants/theme";
import type { Banner } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.82);
const GAP = 12;
const INTERVAL = CARD_WIDTH + GAP;
const ROTATE_MS = 4000;
// Neighbouring slides peek in on both sides of the centred card
const EDGE = (SCREEN_WIDTH - CARD_WIDTH) / 2 - GAP / 2;

interface Props {
  banners: Banner[];
  onPress: (banner: Banner) => void;
}

interface Slide {
  key: string;
  banner: Banner;
}

/** Three copies of the banners, so there is always one peeking on either side; a single banner just sits there */
function slidesOf(banners: Banner[]): Slide[] {
  const copies = banners.length > 1 ? [0, 1, 2] : [0];
  return copies.flatMap((copy) => banners.map((banner) => ({ key: `${copy}-${banner.id}`, banner })));
}

// Memoised so a rotation re-renders only the two slides whose "visible" flag changes, not every copy
const SlideCell = memo(function SlideCell({ banner, visible, onPress }: { banner: Banner; visible: boolean; onPress: (banner: Banner) => void }) {
  return (
    <View style={styles.slide}>
      <HeroBannerSlide banner={banner} width={CARD_WIDTH} onPress={onPress} visible={visible} />
    </View>
  );
});

/** Advances the carousel every few seconds while it loops */
function useAutoAdvance(position: number, count: number, jump: (to: number, animated: boolean) => void, setPosition: (p: number) => void) {
  const loop = count > 1;
  // Restarts on every change, so a manual swipe gets a full interval before the next auto-advance. It always animates
  // forward and lets settle() re-centre on the middle copy when the scroll ends: jumping back first would fire that
  // same scroll-end on iOS, which snapped the carousel straight back onto the last banner
  useEffect(() => {
    if (!loop) return;
    const timer = setTimeout(() => {
      // Only if settle() never re-centred (no scroll-end event) does it step back a copy, so it never runs off the list
      const from = position + 1 >= 3 * count ? position - count : position;
      if (from !== position) jump(from, false);
      jump(from + 1, true);
      setPosition(from + 1);
    }, ROTATE_MS);
    return () => clearTimeout(timer);
  }, [position, count, loop]);
}

/**
 * A centred, snapping banner carousel that loops: it starts in the middle copy and, whenever it drifts into an
 * outer copy, jumps without animation to the same banner in the middle. The "3/8" pager advances on its own.
 */
export function BannerCarousel({ banners, onPress }: Props) {
  const count = banners.length;
  const loop = count > 1;
  const slides = slidesOf(banners);
  const [position, setPosition] = useState(loop ? count : 0);
  const listRef = useRef<FlatList<Slide>>(null);
  const jump = (to: number, animated: boolean) => listRef.current?.scrollToOffset({ offset: to * INTERVAL, animated });

  useAutoAdvance(position, count, jump, setPosition);

  const renderSlide = useCallback(
    ({ item, index }: { item: Slide; index: number }) => <SlideCell banner={item.banner} visible={index === position} onPress={onPress} />,
    [position, onPress],
  );

  const settle = (x: number) => {
    const at = Math.round(x / INTERVAL);
    const centred = loop && (at < count || at >= 2 * count) ? (at % count) + count : at;
    if (centred !== at) jump(centred, false);
    setPosition(centred);
  };

  return (
    <View style={styles.section}>
      <FlatList
        ref={listRef}
        horizontal
        data={slides}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        snapToInterval={INTERVAL}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: EDGE }}
        contentOffset={{ x: (loop ? count : 0) * INTERVAL, y: 0 }}
        onLayout={() => loop && jump(position, false)}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
        extraData={position}
        renderItem={renderSlide}
      />
      {loop && <Pager index={position % count} count={count} />}
    </View>
  );
}

function Pager({ index, count }: { index: number; count: number }) {
  return (
    <View style={styles.pager}>
      {Array.from({ length: count }, (_, i) => {
        const distance = Math.abs(i - index);
        if (distance === 0) {
          return (
            <View key={i} style={styles.pill}>
              <Text style={styles.pillText}>{`${index + 1}/${count}`}</Text>
            </View>
          );
        }
        if (distance > 2) return null;
        const size = distance === 1 ? 7 : 5;
        return <View key={i} style={[styles.dot, { width: size, height: size, borderRadius: size / 2 }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 16 },
  slide: { marginHorizontal: GAP / 2 },
  pager: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 12 },
  pill: { backgroundColor: colors.text, borderRadius: 12, paddingHorizontal: 10, height: 24, justifyContent: "center" },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, color: "#fff" },
  dot: { backgroundColor: "#cbd5e1" },
});
