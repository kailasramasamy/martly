import { memo } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../constants/theme";

interface Props {
  /** Up to 3 pack shots; the first sits in front */
  images: string[];
  size: number;
}

// Back packs lean out to either side and sit a little higher, so the front one reads as nearest
const BACK_POSES = [
  { rotate: "-9deg", shiftX: -0.24, shiftY: -0.04 },
  { rotate: "8deg", shiftX: 0.24, shiftY: -0.02 },
] as const;
const BACK_SCALE = 0.62;
const FRONT_SCALE = 0.72;
const LONE_SCALE = 0.86;
const FRONT_DROP = 0.06;

/** Two or three product packs huddled together, standing in for an aisle's artwork */
export const PackCluster = memo(function PackCluster({ images, size }: Props) {
  const [front, ...back] = images.slice(0, 3);
  if (!front) {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <Ionicons name="basket-outline" size={size * 0.4} color={colors.textSecondary} />
      </View>
    );
  }
  const frontSize = size * (back.length ? FRONT_SCALE : LONE_SCALE);
  const backSize = size * BACK_SCALE;

  return (
    <View style={[styles.box, { width: size, height: size }]} pointerEvents="none">
      {back.map((uri, i) => {
        const pose = BACK_POSES[back.length === 1 ? 1 : i];
        return (
          <Image
            key={uri + i}
            source={{ uri }}
            resizeMode="contain"
            style={[styles.pack, {
              width: backSize, height: backSize,
              transform: [{ translateX: pose.shiftX * size }, { translateY: pose.shiftY * size }, { rotate: pose.rotate }],
            }]}
          />
        );
      })}
      <Image source={{ uri: front }} resizeMode="contain" style={[styles.pack, { width: frontSize, height: frontSize, transform: [{ translateY: back.length ? FRONT_DROP * size : 0 }] }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
  pack: { position: "absolute" },
});
