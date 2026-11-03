import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../constants/theme";
import { useBasketMode } from "../lib/basket-mode-context";
import { useCart } from "../lib/cart-context";
import { useStrings } from "../lib/i18n/use-strings";

const SIZE = 56;

/**
 * For a screen whose own bottom bar leaves no room for FloatingCart. Goes right after its scroll view: the negative margin
 * lifts it over the scroll view's foot without taking any height. aboveBar: the next sibling covers the bottom safe area
 */
export function CartFab({ aboveBar }: { aboveBar: boolean }) {
  const { itemCount } = useCart();
  const { isBasketMode } = useBasketMode();
  const insets = useSafeAreaInsets();
  const t = useStrings("nav");
  if (itemCount === 0 || isBasketMode) return null;
  const gap = aboveBar ? 16 : insets.bottom + 16;
  return (
    <View pointerEvents="box-none" style={[styles.anchor, { marginTop: -(SIZE + gap), marginBottom: gap }]}>
      <Pressable
        onPress={() => router.push("/(tabs)/cart")} style={styles.fab} accessibilityRole="button"
        accessibilityLabel={t.cartWithCount(itemCount)}
      >
        <Ionicons name="bag-handle" size={26} color="#ffffff" />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{itemCount > 99 ? "99+" : itemCount}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { height: SIZE, alignItems: "flex-end", paddingRight: 16 },
  fab: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary,
    shadowColor: "#000000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
  },
  badge: {
    position: "absolute", top: -3, right: -3, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, borderWidth: 2, borderColor: "#ffffff",
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 11, color: colors.accentText },
});
