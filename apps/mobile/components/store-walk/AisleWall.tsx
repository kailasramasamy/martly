import { useRef, type ReactNode } from "react";
import { Animated, Dimensions, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts } from "../../constants/theme";
import { FLOOR } from "./ShopFloor";

// A photo of a local supermarket aisle (generated art, bundled so it shows offline and while a department's own photo
// loads), fading into the shop floor below
const AISLE_PHOTO = require("../../assets/images/store-walk/aisle-wall.webp");
// The photo moves only part of the way as the aisle slides past, so it reads as further off; it's wider than the wall
// by this much each side so its edges never show
const DEPTH = 0.6;
const OVERHANG = 160;
const WALL_HEIGHT = 172;
// Sized outright, so a photo never shows at its own size for a frame before filling the wall
const PHOTO_WIDTH = Dimensions.get("window").width + OVERHANG * 2;
// How far a sideways swipe on the wall has to travel to change aisle
const SWIPE = 40;

/** A neighbouring aisle, hung grey at the wall's edge */
export interface NearAisle { name: string; label: string; onPress: () => void }

// The aisle before or after, hanging further down the store: grey, smaller, half past the edge. Tap it to go there
function SideSign({ aisle, side }: { aisle: NearAisle; side: "left" | "right" }) {
  return (
    <TouchableOpacity
      style={[styles.side, side === "left" ? styles.sideLeft : styles.sideRight]} onPress={aisle.onPress}
      accessibilityRole="button" accessibilityLabel={aisle.label}
    >
      <View style={[styles.cord, styles.cordLeft]} /><View style={[styles.cord, styles.cordRight]} />
      <View style={[styles.sideBoard, side === "left" ? styles.sideBoardLeft : styles.sideBoardRight]}>
        <Text style={styles.sideName} numberOfLines={2}>{aisle.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

// A sideways swipe across the wall walks to the next aisle, or back to the last one
function useSwipe(prev?: NearAisle | null, next?: NearAisle | null) {
  const ends = useRef({ prev, next });
  ends.current = { prev, next };
  return useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_, g) => {
      if (g.dx < -SWIPE) ends.current.next?.onPress();
      else if (g.dx > SWIPE) ends.current.prev?.onPress();
    },
  })).current;
}

/** The aisle behind the hanging sign: a real shop's shelves and lights, so the walk reads as a shop */
interface Props {
  children: ReactNode;
  prev?: NearAisle | null;
  next?: NearAisle | null;
  /** How far the aisle has slid sideways, for the photo's depth */
  slide: Animated.Value;
  /** The department's own aisle photo; without one, the bundled grocery aisle */
  photo: string | null;
}

export function AisleWall({ children, prev, next, slide, photo }: Props) {
  const swipe = useSwipe(prev, next);
  return (
    <View style={styles.wall} {...swipe.panHandlers}>
      <Animated.Image
        source={photo ? { uri: photo } : AISLE_PHOTO} defaultSource={AISLE_PHOTO} resizeMode="cover"
        style={[styles.photo, { transform: [{ translateX: Animated.multiply(slide, -DEPTH) }] }]}
      />
      <LinearGradient
        colors={["rgba(238,243,241,0.05)", "rgba(238,243,241,0.2)", FLOOR]} locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill} pointerEvents="none"
      />
      {prev && <SideSign aisle={prev} side="left" />}
      {next && <SideSign aisle={next} side="right" />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wall: { marginHorizontal: -16, height: WALL_HEIGHT, overflow: "hidden", backgroundColor: FLOOR },
  photo: { position: "absolute", top: 0, left: -OVERHANG, width: PHOTO_WIDTH, height: WALL_HEIGHT },
  side: { position: "absolute", top: 0, width: 132, height: 86, alignItems: "center" },
  sideLeft: { left: -54 },
  sideRight: { right: -54 },
  cord: { position: "absolute", top: 0, width: 2, height: 20, backgroundColor: "#cbd5e1" },
  cordLeft: { left: "30%" },
  cordRight: { right: "30%" },
  sideBoard: {
    marginTop: 20, width: 132, height: 50, borderRadius: 10, backgroundColor: "#b8c4cf", flexDirection: "row", alignItems: "center",
    paddingHorizontal: 6, opacity: 0.85,
  },
  // The name sits in the part still on screen
  sideBoardLeft: { paddingLeft: 60 },
  sideBoardRight: { paddingRight: 60 },
  sideName: { flex: 1, fontFamily: fonts.extrabold, fontSize: 12, lineHeight: 15, color: "#475569", textAlign: "center" },
});
