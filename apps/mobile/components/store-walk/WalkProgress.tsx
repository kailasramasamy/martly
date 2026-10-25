import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors } from "../../constants/theme";
import { useReduceMotion } from "../../lib/use-reduce-motion";

function Segment({ state }: { state: "done" | "current" | "ahead" }) {
  const reduce = useReduceMotion();
  const fill = useRef(new Animated.Value(state === "ahead" ? 0 : 1)).current;
  useEffect(() => {
    const toValue = state === "ahead" ? 0 : 1;
    if (reduce) return fill.setValue(toValue);
    Animated.timing(fill, { toValue, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [fill, state, reduce]);
  return (
    <View style={styles.track}>
      <Animated.View
        style={[styles.fill, state === "current" && styles.current, { transform: [{ scaleX: fill }] }]}
      />
    </View>
  );
}

/** One segment per aisle: walked ones solid, the current one filling in */
export function WalkProgress({ count, index }: { count: number; index: number }) {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <Segment key={i} state={i < index ? "done" : i === index ? "current" : "ahead"} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 3, paddingHorizontal: 16 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden" },
  fill: { flex: 1, backgroundColor: colors.primary, transformOrigin: "left" },
  current: { backgroundColor: colors.primaryLight },
});
