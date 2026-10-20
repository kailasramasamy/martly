import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View, StyleSheet } from "react-native";
import { colors, fonts, spacing } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";

const DOT_COUNT = 3;
const BOUNCE_MS = 320;

function BouncingDots() {
  const values = useRef(Array.from({ length: DOT_COUNT }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const bounce = (v: Animated.Value) => Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: BOUNCE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: BOUNCE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    const loop = Animated.loop(Animated.stagger(BOUNCE_MS / 2, values.map(bounce)));
    loop.start();
    return () => loop.stop();
  }, [values]);

  return (
    <View style={styles.dots}>
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, {
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }],
          }]}
        />
      ))}
    </View>
  );
}

// Covers stale results while a tab/filter change refetches
export function SearchLoadingOverlay({ label, top }: { label: string | null; top: number }) {
  const t = useStrings("search");
  return (
    <View style={[styles.overlay, { paddingTop: top + 64 }]} pointerEvents="auto" accessibilityRole="progressbar" accessibilityLabel={t.loadingProducts}>
      <View style={styles.loaderCard}>
        <BouncingDots />
        <Text style={styles.loaderText} numberOfLines={1}>
          {label ? <>{t.finding}<Text style={styles.loaderBold}>{label}</Text>{t.findingAfter}</> : t.updatingResults}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.85)", alignItems: "center" },
  loaderCard: {
    alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, maxWidth: "80%",
    backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#ccfbf1",
    shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  dots: { flexDirection: "row", gap: 8, height: 24, alignItems: "flex-end" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  loaderText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  loaderBold: { fontFamily: fonts.bold, color: colors.text },
});
