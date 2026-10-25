import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../constants/theme";
import { useReduceMotion } from "../../lib/use-reduce-motion";

/**
 * The aisle's name on a board hanging from two cords, like the signs above supermarket aisles. It drops in and swings
 * to rest each time it mounts, so give it the aisle as its `key`.
 */
export function AisleSign({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const reduce = useReduceMotion();
  const drop = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const swing = useRef(new Animated.Value(reduce ? 0 : 1)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.parallel([
      Animated.timing(drop, { toValue: 1, duration: 360, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.spring(swing, { toValue: 0, velocity: 2, stiffness: 120, damping: 6, mass: 0.8, useNativeDriver: true }),
    ]).start();
  }, [drop, swing, reduce]);
  const rotate = swing.interpolate({ inputRange: [-1, 1], outputRange: ["-8deg", "8deg"] });
  const translateY = drop.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] });
  return (
    <View style={styles.frame}>
      <View style={[styles.cord, styles.cordLeft]} />
      <View style={[styles.cord, styles.cordRight]} />
      <Animated.View style={[styles.board, { opacity: drop, transform: [{ translateY }, { rotate }] }]} accessibilityRole="header">
        {imageUrl && <View style={styles.badge}><Image source={{ uri: imageUrl }} style={styles.image} /></View>}
        <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{name}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 92, alignItems: "center" },
  cord: { position: "absolute", top: 0, width: 2, height: 18, backgroundColor: "#94a3b8" },
  cordLeft: { left: "32%" },
  cordRight: { right: "32%" },
  board: {
    marginTop: 16, minWidth: 150, maxWidth: "56%", height: 64, paddingLeft: 8, paddingRight: 22, borderRadius: 12, gap: 12,
    flexDirection: "row", backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center", transformOrigin: "top",
    shadowColor: "#0f172a", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  name: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 21, color: "#ffffff" },
  badge: { width: 48, height: 48, borderRadius: 10, backgroundColor: "#ffffff", padding: 3 },
  image: { flex: 1, resizeMode: "contain" },
});
