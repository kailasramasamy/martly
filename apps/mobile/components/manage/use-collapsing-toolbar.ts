import { useMemo, useRef, useState } from "react";
import { Animated, type LayoutChangeEvent } from "react-native";

/**
 * Toolbar that slides away as the list scrolls down and comes back on any scroll up.
 * Pulling down at the top drags it along so the refresh spinner shows above it.
 */
export function useCollapsingToolbar(enabled: boolean) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(0);

  const translateY = useMemo(() => {
    if (!enabled || height === 0) return new Animated.Value(0);
    const scrolled = scrollY.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: "clamp" });
    const hidden = Animated.diffClamp(scrolled, 0, height).interpolate({ inputRange: [0, height], outputRange: [0, -height] });
    const pulled = scrollY.interpolate({ inputRange: [-height, 0], outputRange: [height, 0], extrapolate: "clamp" });
    return Animated.add(hidden, pulled);
  }, [enabled, height, scrollY]);

  return {
    height,
    translateY,
    // Rounded so sub-pixel relayouts don't rebuild the native animation graph
    onLayout: (e: LayoutChangeEvent) => setHeight(Math.round(e.nativeEvent.layout.height)),
    onScroll: Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
  };
}
