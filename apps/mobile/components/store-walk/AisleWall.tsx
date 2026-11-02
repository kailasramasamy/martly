import { useRef, type ReactNode } from "react";
import { Animated, Dimensions, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts } from "../../constants/theme";
import { AISLE } from "./aisle-theme";

// A photo of a local supermarket aisle (generated art, bundled so it shows offline and while a department's own photo
// loads)
const AISLE_PHOTO = require("../../assets/images/store-walk/aisle-wall.webp");
// The photo moves only part of the way as the aisle slides past, so it reads as further off; it's wider than the wall
// by this much each side so its edges never show
const DEPTH = 0.6;
const OVERHANG = 160;
const WALL_HEIGHT = 112;
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

interface BackdropProps {
  /** How far the aisle has slid sideways, for the photo's depth */
  slide: Animated.Value;
  /** The department's own aisle photo; without one, the bundled grocery aisle */
  photo: string | null;
}

/** A real shop's shelves and lights behind the sign, boards and brands, fading into the pale floor only at their foot */
export function AisleBackdrop({ slide, photo }: BackdropProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.Image
        source={photo ? { uri: photo } : AISLE_PHOTO} defaultSource={AISLE_PHOTO} resizeMode="cover"
        style={[styles.photo, { transform: [{ translateX: Animated.multiply(slide, -DEPTH) }] }]}
      />
      <LinearGradient
        colors={["rgba(238,243,241,0)", "rgba(238,243,241,0.1)", "#eef3f1"]} locations={[0, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** The strip the aisle's sign hangs in, with the aisles either side; swipe across it to change aisle */
export function AisleWall({ children, prev, next }: { children: ReactNode; prev?: NearAisle | null; next?: NearAisle | null }) {
  const swipe = useSwipe(prev, next);
  return (
    <View style={styles.wall} {...swipe.panHandlers}>
      {prev && <SideSign aisle={prev} side="left" />}
      {next && <SideSign aisle={next} side="right" />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wall: { marginHorizontal: -16, height: WALL_HEIGHT, overflow: "hidden" },
  photo: { position: "absolute", top: 0, bottom: 0, left: -OVERHANG, width: PHOTO_WIDTH },
  side: { position: "absolute", top: 0, width: 132, height: 68, alignItems: "center" },
  sideLeft: { left: -54 },
  sideRight: { right: -54 },
  cord: { position: "absolute", top: 0, width: 2, height: 14, backgroundColor: "#475569" },
  cordLeft: { left: "30%" },
  cordRight: { right: "30%" },
  sideBoard: {
    marginTop: 14, width: 132, height: 44, borderRadius: 10, backgroundColor: "#ffffff", flexDirection: "row", alignItems: "center",
    paddingHorizontal: 6, opacity: 0.92,
  },
  // The name sits in the part still on screen
  sideBoardLeft: { paddingLeft: 60 },
  sideBoardRight: { paddingRight: 60 },
  sideName: { flex: 1, fontFamily: fonts.extrabold, fontSize: 12, lineHeight: 15, color: AISLE.text, textAlign: "center" },
});
