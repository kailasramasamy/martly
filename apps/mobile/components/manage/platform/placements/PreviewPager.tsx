import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { colors, fonts } from "../../../../constants/theme";
import { manage } from "../../ui/tokens";
import type { PlacementMockup } from "./placement-previews";

/** Paging mockups with captions and dots, sized to whatever container holds it */
export function PreviewPager({ mockups }: { mockups: PlacementMockup[] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd}>
          {mockups.map((m, i) => (
            <View key={i} style={[styles.page, { width }]}>
              <m.render />
              <Text style={styles.caption}>{m.caption}</Text>
            </View>
          ))}
        </ScrollView>
      )}
      {mockups.length > 1 ? (
        <View style={styles.dots}>
          {mockups.map((_, i) => <View key={i} style={[styles.dot, i === index && styles.dotOn]} />)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 8, gap: 16 },
  caption: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text, textAlign: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: manage.line },
  dotOn: { width: 18, backgroundColor: colors.primary },
});
