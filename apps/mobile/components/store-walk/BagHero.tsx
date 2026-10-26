import { Animated, Image, StyleSheet, View } from "react-native";
import type { CartItem } from "../../lib/cart-context";
import { DoneMark } from "./NextDepartmentCard";
import { useEntrance } from "./motion";

const BAG = require("../../assets/images/store-walk/paper-bag.webp");
// The photo is 540 × 728 and its front rim runs 7.14% of the way down
const WIDTH = 112;
const HEIGHT = Math.round((WIDTH * 728) / 540);
const RIM_Y = Math.round(HEIGHT * 0.0714);
const PACK = 62;
// Room above the bag for the packs standing up out of it
const HEADROOM = 40;
// Where each pack stands in the mouth: the first two at the back, the next two sunk deeper in front
const SPOTS = [
  { left: 2, sink: 22, rotate: "-11deg" },
  { left: 48, sink: 18, rotate: "9deg" },
  { left: 22, sink: 34, rotate: "-3deg" },
  { left: 56, sink: 40, rotate: "13deg" },
];

function Pack({ uri, spot, i }: { uri: string; spot: (typeof SPOTS)[number]; i: number }) {
  const drop = useEntrance(250 + i * 140, -44);
  const place = { left: spot.left, top: HEADROOM + RIM_Y + spot.sink - PACK };
  return (
    <Animated.Image
      source={{ uri }}
      style={[styles.pack, place, { opacity: drop.opacity, transform: [...drop.transform, { rotate: spot.rotate }] }]}
    />
  );
}

/**
 * A paper bag with the walk's own packs standing in it and the done mark on its corner. The bag photo is drawn twice:
 * whole behind the packs, then only below its front rim in front of them, so the packs sit inside it.
 */
export function BagHero({ items }: { items: CartItem[] }) {
  const packs = items.filter((i) => i.imageUrl).slice(0, SPOTS.length);
  return (
    <View style={styles.hero}>
      <Image source={BAG} style={styles.bag} />
      {packs.map((item, i) => <Pack key={item.storeProductId} uri={item.imageUrl!} spot={SPOTS[i]} i={i} />)}
      <View style={styles.front}>
        <Image source={BAG} style={styles.frontImage} />
      </View>
      <View style={styles.mark}>
        <DoneMark />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: WIDTH + 16, height: HEADROOM + HEIGHT },
  bag: { position: "absolute", top: HEADROOM, width: WIDTH, height: HEIGHT },
  // Catalog photos have white backgrounds; multiplied, the white drops away against the bag and the panel
  pack: { position: "absolute", width: PACK, height: PACK, resizeMode: "contain", mixBlendMode: "multiply" },
  front: { position: "absolute", top: HEADROOM + RIM_Y, width: WIDTH, height: HEIGHT - RIM_Y, overflow: "hidden" },
  frontImage: { width: WIDTH, height: HEIGHT, marginTop: -RIM_Y },
  mark: {
    position: "absolute", right: -6, top: HEADROOM + HEIGHT - 58, borderRadius: 40, borderWidth: 4, borderColor: "#fbf6ee",
    transform: [{ scale: 0.7 }],
  },
});
