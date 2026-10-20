import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, Text, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";

// Offered once the shopper is a couple of screens down
const SHOW_AFTER = Dimensions.get("window").height * 2;

/** Tracks the list's scroll for the pill; returns whether to show it */
export function useBackToTop() {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > SHOW_AFTER;
    if (next === visibleRef.current) return;
    visibleRef.current = next;
    setVisible(next);
  }, []);
  return { visible, onScroll };
}

interface Props {
  visible: boolean;
  /** Distance from the top of the screen, just under the header */
  top: number;
  onPress: () => void;
}

export const BackToTopPill = memo(function BackToTopPill({ visible, top, onPress }: Props) {
  const t = useStrings("home");
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(shown, { toValue: visible ? 1 : 0, friction: 8, tension: 90, useNativeDriver: true }).start();
  }, [shown, visible]);
  const translateY = shown.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });

  return (
    <Animated.View
      style={[styles.wrap, { top, opacity: shown, transform: [{ translateY }] }]}
      pointerEvents={visible ? "box-none" : "none"}
    >
      <Pressable onPress={onPress} style={styles.pill} accessibilityRole="button" accessibilityLabel={t.backToTop}>
        <Ionicons name="arrow-up" size={14} color="#fff" />
        <Text style={styles.text}>{t.backToTop}</Text>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 20 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 18, borderRadius: 22,
    backgroundColor: colors.text,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  text: { fontFamily: fonts.bold, fontSize: 13, color: "#fff" },
});
