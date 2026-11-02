import { useState } from "react";
import { Animated, Image, StyleSheet, View, type ImageLoadEventData, type NativeSyntheticEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { CartItem } from "../../lib/cart-context";
import { DoneMark } from "./NextDepartmentCard";
import { useEntrance } from "./motion";

type Spot = { left: number; sink: number; rotate: string };

// Most packs stand taller than wide; the real shape takes over once the photo loads
const GUESS_ASPECT = 0.72;

// What the shopper carries. `rim` is how far down the image its front rim runs. `spots` is where each pack stands, as how
// far below the rim its foot is: the floor fills first, then the pile builds up behind, resting on it and leaning. A
// longer cart shows it full; the list has every line
const BASKET = {
  image: require("../../assets/images/store-walk/basket.webp"), width: 150, ratio: 0.52, rim: 0.095, pack: 104,
  // Drawn shallower than the photo (ratio 0.62) so packs standing on its floor still show their brands above the rim.
  // The solid sides are dark inside, as it's lit from above
  deep: true,
  spots: [
    { left: 23, sink: 66, rotate: "-2deg" }, { left: 7, sink: 64, rotate: "-11deg" }, { left: 39, sink: 64, rotate: "11deg" },
    { left: 10, sink: 44, rotate: "6deg" }, { left: 38, sink: 44, rotate: "-6deg" }, { left: 24, sink: 30, rotate: "10deg" },
  ] as Spot[],
};
const TROLLEY = {
  image: require("../../assets/images/store-walk/trolley.webp"), width: 120, ratio: 648 / 420, rim: 0.225, pack: 54,
  deep: false,
  spots: [
    { left: 26, sink: 84, rotate: "-3deg" }, { left: 48, sink: 84, rotate: "4deg" }, { left: 4, sink: 84, rotate: "-5deg" }, { left: 66, sink: 84, rotate: "5deg" },
    { left: 36, sink: 56, rotate: "6deg" }, { left: 14, sink: 56, rotate: "-6deg" }, { left: 58, sink: 56, rotate: "-4deg" },
    { left: 26, sink: 26, rotate: "4deg" }, { left: 48, sink: 26, rotate: "-5deg" }, { left: 3, sink: 26, rotate: "-8deg" }, { left: 68, sink: 26, rotate: "8deg" },
    { left: 36, sink: 8, rotate: "3deg" },
  ] as Spot[],
};

// Sized to the photo's own shape, so its foot is the pack's foot and it stands on the floor, whatever its shape
function Pack({ item, spot, size, rimAt, i }: { item: CartItem; spot: Spot; size: number; rimAt: number; i: number }) {
  const drop = useEntrance(250 + i * 140, -44);
  const [aspect, setAspect] = useState(GUESS_ASPECT);
  const onLoad = ({ nativeEvent: { source } }: NativeSyntheticEvent<ImageLoadEventData>) => {
    if (source.width && source.height) setAspect(source.width / source.height);
  };
  const width = size * Math.min(1, aspect);
  const height = size * Math.min(1, 1 / aspect);
  const place = { left: spot.left + (size - width) / 2, top: rimAt + spot.sink - height, width, height };
  return (
    <Animated.Image
      source={{ uri: item.cutoutUrl! }} onLoad={onLoad}
      style={[styles.pack, place, { opacity: drop.opacity, transform: [...drop.transform, { rotate: spot.rotate }] }]}
    />
  );
}

/**
 * The basket or trolley with the cart's cut-out packs in it (a photo's white background would show), and the done mark on
 * its corner at the walk's end. The image is drawn twice: whole behind the packs, then only below its front rim in front of them, so the
 * packs sit inside it and show through its sides.
 */
export function BagHero({ items, trolley, done, scale = 1 }: { items: CartItem[]; trolley: boolean; done?: boolean; scale?: number }) {
  const kind = trolley ? TROLLEY : BASKET;
  const height = Math.round(kind.width * kind.ratio);
  const rim = Math.round(height * kind.rim);
  const size = { width: kind.width, height };
  // The top of the pile is furthest back, so it's drawn first
  const stacked = items.filter((i) => i.cutoutUrl).slice(0, kind.spots.length)
    .map((item, i) => ({ item, spot: kind.spots[i] })).sort((a, b) => a.spot.sink - b.spot.sink);
  // Only as much room above as the pile's top pack needs
  const room = Math.max(8, kind.pack - (stacked[0]?.spot.sink ?? kind.pack) - rim + 8);
  return (
    <View style={{ width: (kind.width + 8) * scale, height: (room + height) * scale }}>
      <View style={{ width: kind.width + 8, height: room + height, transform: [{ scale }], transformOrigin: "top left" }}>
        <Image source={kind.image} resizeMode="stretch" style={[styles.whole, size, { top: room }]} />
        {stacked.map(({ item, spot }, i) => (
          <Pack key={item.storeProductId} item={item} spot={spot} size={kind.pack} rimAt={room + rim} i={i} />
        ))}
        {kind.deep && (
          <LinearGradient
            colors={["rgba(15,23,42,0)", "rgba(15,23,42,0.4)"]} pointerEvents="none"
            style={[styles.shade, { top: room + rim, left: kind.width * 0.13, width: kind.width * 0.74, height: (height - rim) * 0.88 }]}
          />
        )}
        <View style={[styles.front, { top: room + rim, width: kind.width, height: height - rim }]}>
          <Image source={kind.image} resizeMode="stretch" style={[size, { marginTop: -rim }]} />
        </View>
        {done && (
          <View style={[styles.mark, { top: room + height - 58 }]}>
            <DoneMark />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  whole: { position: "absolute" },
  // iOS draws a transparent image's shadow along the pack's own outline, parting the packs in the pile
  pack: {
    position: "absolute", resizeMode: "contain", transformOrigin: "bottom",
    shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  shade: { position: "absolute" },
  front: { position: "absolute", overflow: "hidden" },
  mark: {
    position: "absolute", right: -8, borderRadius: 40, borderWidth: 4, borderColor: "#f0fdfa",
    transform: [{ scale: 0.7 }],
  },
});
