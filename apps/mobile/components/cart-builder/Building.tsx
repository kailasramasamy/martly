import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";

const ICONS = ["leaf", "nutrition", "egg", "cafe", "fish", "water"] as const;
const RING = 168;
const ICON = 40;

/** Loops a value 0 → 1 for as long as the screen shows */
function useLoop(duration: number, easing = Easing.linear) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [value, duration, easing]);
  return value;
}

/** Grocery icons circling a basket while the list is read and matched against the store */
export function Building({ count }: { count: number }) {
  const t = useStrings("shoppingList");
  const spin = useLoop(6000);
  const pulse = useLoop(1400, Easing.inOut(Easing.quad));
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const unrotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });
  const scale = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });
  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]}>
          {ICONS.map((icon, i) => {
            const a = (i / ICONS.length) * 2 * Math.PI;
            const pos = { left: RING / 2 + Math.cos(a) * (RING / 2) - ICON / 2, top: RING / 2 + Math.sin(a) * (RING / 2) - ICON / 2 };
            return (
              // Each icon turns back as the ring turns, so it stays upright
              <Animated.View key={icon} style={[styles.icon, pos, { transform: [{ rotate: unrotate }] }]}>
                <Ionicons name={icon} size={20} color={colors.primary} />
              </Animated.View>
            );
          })}
        </Animated.View>
        <Animated.View style={[styles.basket, { transform: [{ scale }] }]}>
          <Ionicons name="basket" size={44} color="#ffffff" />
        </Animated.View>
      </View>
      <Text style={styles.title}>{t.finding(count)}</Text>
      <Text style={styles.hint}>{t.findingHint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10, backgroundColor: colors.surface },
  stage: { width: RING + ICON, height: RING + ICON, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  ring: { position: "absolute", width: RING, height: RING, top: ICON / 2, left: ICON / 2 },
  icon: { position: "absolute", width: ICON, height: ICON, borderRadius: ICON / 2, backgroundColor: "#ffffff", borderWidth: 1.5, borderColor: "#99f6e4", alignItems: "center", justifyContent: "center" },
  basket: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", shadowColor: colors.primaryDark, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, textAlign: "center" },
  hint: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, textAlign: "center" },
});
