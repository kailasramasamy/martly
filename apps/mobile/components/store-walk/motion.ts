import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { useReduceMotion } from "../../lib/use-reduce-motion";

/** Fades and rises an element in once, after `delay` ms; pass a new `key` prop on the element to replay it */
export function useEntrance(delay = 0, distance = 14) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return progress.setValue(1);
    Animated.timing(progress, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [progress, delay, reduce]);
  return {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  };
}

/** A number that counts up (or down) to `value` over a short tween */
export function useCountUp(value: number) {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(value);
  const anim = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    if (reduce) return setShown(value);
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [anim, value, reduce]);
  return shown;
}
