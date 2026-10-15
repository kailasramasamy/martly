import { useState } from "react";
import { View, ScrollView, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../constants/theme";
import { manage } from "../ui/tokens";

interface PhotoSwiperProps {
  photos: string[];
  size: number;
  /** Tapped photo's position, e.g. to open it full screen */
  onPress: (index: number) => void;
  accessibilityLabel: string;
}

/** Page indicator: a dot per photo, the current one stretched; keeps its height with one photo so grid rows align */
export function PhotoDots({ count, index, dark }: { count: number; index: number; dark?: boolean }) {
  return (
    <View style={styles.dots} accessibilityLabel={count > 1 ? `Photo ${index + 1} of ${count}` : undefined}>
      {count > 1 && Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, dark && styles.dotDark, i === index && (dark ? styles.dotActiveDark : styles.dotActive)]} />
      ))}
    </View>
  );
}

/** Square photo pager: swipe through a product's shots, dots show how many there are and which is showing */
export function PhotoSwiper({ photos, size, onPress, accessibilityLabel }: PhotoSwiperProps) {
  const [index, setIndex] = useState(0);
  if (photos.length === 0) {
    return (
      <View>
        <Pressable style={[styles.empty, { width: size, height: size }]} onPress={() => onPress(0)} accessibilityLabel={accessibilityLabel}>
          <Ionicons name="image-outline" size={24} color={manage.muted} />
        </Pressable>
        <View style={styles.dots} />
      </View>
    );
  }
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={photos.length > 1}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / size))}
        style={{ width: size, height: size }}
      >
        {photos.map((uri, i) => (
          <Pressable key={`${uri}-${i}`} onPress={() => onPress(i)} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
            <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />
          </Pressable>
        ))}
      </ScrollView>
      <PhotoDots count={photos.length} index={index} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center", backgroundColor: manage.hairline },
  dots: { flexDirection: "row", justifyContent: "center", gap: 4, paddingTop: 6, height: 11 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: manage.line },
  dotActive: { width: 12, backgroundColor: colors.primary },
  dotDark: { backgroundColor: "rgba(255,255,255,0.35)" },
  dotActiveDark: { width: 12, backgroundColor: "#fff" },
});
