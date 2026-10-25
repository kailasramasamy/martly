import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../constants/theme";
import { useStrings } from "../lib/i18n/use-strings";
import { useReduceMotion } from "../lib/use-reduce-motion";

const DOTS = 3;
const SIZES = { small: { dot: 6, gap: 4, hop: 6 }, large: { dot: 10, gap: 6, hop: 10 } } as const;
// One hop up and down, and the pause before the wave starts again
const HOP_MS = 260;
const STAGGER_MS = 130;
const REST_MS = 220;

interface LoaderProps {
  size?: keyof typeof SIZES;
  /** One colour for every dot (e.g. white in a button); without it, the brand's teal with an amber middle dot */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

// Each dot hops in turn, a wave across the three; with Reduce Motion they only fade
function useWave(reduce: boolean) {
  const dots = useRef(Array.from({ length: DOTS }, () => new Animated.Value(0))).current;
  useEffect(() => {
    const timing = (v: Animated.Value, toValue: number) =>
      Animated.timing(v, { toValue, duration: HOP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    const wave = Animated.loop(Animated.sequence([
      Animated.stagger(STAGGER_MS, dots.map((v) => Animated.sequence([timing(v, 1), timing(v, 0)]))),
      Animated.delay(REST_MS),
    ]));
    wave.start();
    return () => wave.stop();
  }, [dots, reduce]);
  return dots;
}

/** The app's loading indicator: three dots hopping in a wave. Takes the place of ActivityIndicator everywhere */
export function Loader({ size = "small", color, style }: LoaderProps) {
  const reduce = useReduceMotion();
  const tc = useStrings("common");
  const dots = useWave(reduce);
  const { dot, gap, hop } = SIZES[size];
  const fill = (i: number) => color ?? (i === 1 ? colors.accent : colors.primary);
  return (
    <View
      style={[styles.row, { gap, height: dot + hop }, style]}
      accessibilityRole="progressbar" accessibilityLabel={tc.loading}
    >
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: dot, height: dot, borderRadius: dot / 2, backgroundColor: fill(i),
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [reduce ? 0.35 : 0.7, 1] }),
            transform: reduce ? [] : [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -hop] }) }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", alignSelf: "center" },
});
