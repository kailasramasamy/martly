import { useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, View, StyleSheet, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { colors } from "../../constants/theme";

/**
 * Scroll-linked header: slides up as the list scrolls down and back as it scrolls up (diffClamp),
 * crossfading the full section into a compact row. Driven on the native thread.
 */
export function useCollapsingHeader() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [fullHeight, setFullHeight] = useState(0);
  const [compactHeight, setCompactHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const distance = Math.max(fullHeight - compactHeight, 1);

  const progress = useMemo(() => {
    const y = scrollY.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: "clamp" });
    return Animated.diffClamp(y, 0, distance);
  }, [scrollY, distance]);

  // Native-driven values don't reach JS, so mirror the diffClamp here to know which row takes touches
  const distanceRef = useRef(distance);
  distanceRef.current = distance;
  const clamp = useRef({ lastY: 0, value: 0 });

  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: true,
      listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = Math.max(e.nativeEvent.contentOffset.y, 0);
        const c = clamp.current;
        c.value = Math.min(Math.max(c.value + y - c.lastY, 0), distanceRef.current);
        c.lastY = y;
        setCollapsed(c.value > distanceRef.current / 2);
      },
    }),
    [scrollY],
  );

  const measure = (setter: (h: number) => void) => (e: LayoutChangeEvent) => setter(Math.round(e.nativeEvent.layout.height));

  return {
    progress, distance, fullHeight, collapsed, onScroll,
    onFullLayout: measure(setFullHeight),
    onCompactLayout: measure(setCompactHeight),
  };
}

type HeaderState = ReturnType<typeof useCollapsingHeader>;

export function CollapsingHeader({ header, full, compact }: {
  header: HeaderState;
  // Each slot gets `hidden` so it can reposition itself while the other one is on screen
  full: (hidden: boolean) => ReactNode;
  compact: (hidden: boolean) => ReactNode;
}) {
  const { progress, distance, collapsed } = header;
  const translateY = progress.interpolate({ inputRange: [0, distance], outputRange: [0, -distance], extrapolate: "clamp" });
  const fullOpacity = progress.interpolate({ inputRange: [0, distance * 0.6], outputRange: [1, 0], extrapolate: "clamp" });
  const compactOpacity = progress.interpolate({ inputRange: [distance * 0.4, distance], outputRange: [0, 1], extrapolate: "clamp" });

  return (
    <Animated.View style={[styles.header, { transform: [{ translateY }] }]}>
      <Animated.View style={{ opacity: fullOpacity }} onLayout={header.onFullLayout} pointerEvents={collapsed ? "none" : "auto"}>
        {full(collapsed)}
      </Animated.View>
      <Animated.View style={[styles.compact, { opacity: compactOpacity }]} pointerEvents={collapsed ? "auto" : "none"}>
        <View onLayout={header.onCompactLayout}>{compact(!collapsed)}</View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1, backgroundColor: colors.background },
  compact: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
