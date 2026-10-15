import { useRef, type ReactNode } from "react";
import { View, Text, Animated, PanResponder, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../../../constants/theme";

const TRIGGER = 90;
const MAX_PULL = 130;

interface SwipeToAdvanceProps {
  children: ReactNode;
  label?: string;
  color?: string;
  /** No forward step, or selection mode: swiping is off */
  disabled?: boolean;
  onAdvance: () => void;
}

/** Swipe a row to the right to advance its order to the next status */
export function SwipeToAdvance({ children, label, color = "#0f766e", disabled, onAdvance }: SwipeToAdvanceProps) {
  const x = useRef(new Animated.Value(0)).current;
  const live = useRef({ disabled, onAdvance });
  live.current = { disabled, onAdvance };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !live.current.disabled && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => x.setValue(Math.min(Math.max(g.dx, 0), MAX_PULL)),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (g.dx >= TRIGGER) live.current.onAdvance();
        Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  const revealOpacity = x.interpolate({ inputRange: [0, 30, TRIGGER], outputRange: [0, 0.6, 1], extrapolate: "clamp" });

  return (
    <View>
      {!disabled && (
        <Animated.View style={[styles.reveal, { backgroundColor: color, opacity: revealOpacity }]} pointerEvents="none">
          <Ionicons name="arrow-forward-circle" size={22} color="#fff" />
          <Text style={styles.revealLabel} numberOfLines={1}>{label}</Text>
        </Animated.View>
      )}
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  reveal: { ...StyleSheet.absoluteFillObject, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16 },
  revealLabel: { fontFamily: fonts.bold, fontSize: 14, color: "#fff", maxWidth: 110 },
});
