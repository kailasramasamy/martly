import { useEffect, useRef, useState } from "react";
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

/** A centred, snapping banner carousel with a "3/8" pager that advances on its own. */
export function BannerCarousel({ banners, onPress }: Props) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Banner>>(null);
  const count = banners.length;

  // Restarts on every change, so a manual swipe gets a full interval before the next auto-advance
  useEffect(() => {
    if (count <= 1) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % count;
      listRef.current?.scrollToOffset({ offset: next * INTERVAL, animated: true });
      setIndex(next);
    }, ROTATE_MS);
    return () => clearTimeout(timer);
  }, [index, count]);

  return (
    <View style={styles.section}>
      <FlatList
        ref={listRef}
        horizontal
        data={banners}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={INTERVAL}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: EDGE }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / INTERVAL))}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <HeroBannerSlide banner={item} width={CARD_WIDTH} onPress={onPress} visible={banners[index]?.id === item.id} />
          </View>
        )}
      />
      {count > 1 && <Pager index={index} count={count} />}
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
