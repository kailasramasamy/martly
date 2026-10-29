import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useReduceMotion } from "../../lib/use-reduce-motion";

export const SPARK_ANGLES = [0, 60, 120, 180, 240, 300];
const DROP = 220;

const timing = (value: Animated.Value, toValue: number, duration: number, easing = Easing.out(Easing.cubic)) =>
  Animated.timing(value, { toValue, duration, easing, useNativeDriver: true });

/** A coin drops into the wallet, the wallet bounces and throws sparks, then the words rise in */
export function useCelebrationMotion(active: boolean) {
  const reduce = useReduceMotion();
  const drop = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const words = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    if (reduce) {
      drop.setValue(1);
      burst.setValue(1);
      words.setValue(1);
      return;
    }
    const run = Animated.sequence([
      Animated.delay(250),
      timing(drop, 1, 650, Easing.in(Easing.quad)),
      Animated.parallel([
        Animated.sequence([timing(bounce, 1, 140), Animated.spring(bounce, { toValue: 0, friction: 4, useNativeDriver: true })]),
        timing(burst, 1, 700),
        Animated.sequence([Animated.delay(200), timing(words, 1, 450)]),
      ]),
    ]);
    run.start();
    return () => run.stop();
  }, [active, reduce, drop, bounce, burst, words]);

  return motionStyles({ drop, bounce, burst, words });
}

interface Values {
  drop: Animated.Value;
  bounce: Animated.Value;
  burst: Animated.Value;
  words: Animated.Value;
}

function motionStyles({ drop, bounce, burst, words }: Values) {
  return {
    coin: {
      opacity: drop.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
      transform: [
        { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-DROP, 6] }) },
        { rotateY: drop.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "540deg"] }) },
        { scale: drop.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0.55] }) },
      ],
    },
    wallet: { transform: [{ scale: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }] },
    spark: (angle: number) => {
      const rad = (angle * Math.PI) / 180;
      return {
        opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
        transform: [
          { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * 84] }) },
          { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * 84] }) },
          { scale: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1, 0.5] }) },
        ],
      };
    },
    words: {
      opacity: words,
      transform: [{ translateY: words.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    },
  };
}
