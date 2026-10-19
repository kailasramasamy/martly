import { memo, useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import type { StoreProduct } from "../../../../lib/types";

const CARD_W = 70;
const CARD_H = 86;
const FAN_WIDTH = 150;
// Back to front: each card leans a little further right, like a hand of cards being shown
const POSES = [
  { rotate: -16, x: 0, y: 14 },
  { rotate: -3, x: 36, y: 2 },
  { rotate: 11, x: 74, y: 10 },
] as const;

function imageOf(item: StoreProduct) {
  return item.variant?.imageUrl ?? item.product.imageUrl;
}

/** The campaign's standout products dealt out as a fanned hand; the cards spread open when the card first shows */
export const HighlightFan = memo(function HighlightFan({ products, edge }: { products: StoreProduct[]; edge: string }) {
  // Highlights list every size of a product, so the same pack shot can repeat
  const images = [...new Set(products.map(imageOf).filter((uri): uri is string => Boolean(uri)))].slice(0, POSES.length);
  const spread = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(spread, { toValue: 1, friction: 6, tension: 60, delay: 150, useNativeDriver: true }).start();
  }, [spread]);
  if (images.length === 0) return null;
  // With fewer cards the hand still ends on the right-most pose
  const poses = POSES.slice(POSES.length - images.length);

  return (
    <View style={styles.fan} pointerEvents="none">
      {images.map((uri, i) => {
        const pose = poses[i];
        const rotate = spread.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${pose.rotate}deg`] });
        const translateX = spread.interpolate({ inputRange: [0, 1], outputRange: [POSES[1].x, pose.x] });
        return (
          <Animated.View key={uri + i} style={[styles.card, { borderColor: edge, transform: [{ translateX }, { translateY: pose.y }, { rotate }] }]}>
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
          </Animated.View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  fan: { width: FAN_WIDTH, height: CARD_H + 28 },
  card: {
    position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H, borderRadius: 12, borderWidth: 1,
    backgroundColor: "#fff", padding: 6,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  image: { flex: 1 },
});
