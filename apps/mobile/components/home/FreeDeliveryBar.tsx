import { memo, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useBasketMode } from "../../lib/basket-mode-context";
import { useCart } from "../../lib/cart-context";
import { useStrings } from "../../lib/i18n/use-strings";

const UNLOCKED_MS = 2500;

interface Props {
  /** Cart total that unlocks free delivery; null when delivery is already free for this shopper */
  threshold: number | null;
  storeId: string | undefined;
}

const rupees = (n: number) => `₹${Math.ceil(n).toLocaleString("en-IN")}`;

/** Crossing the line flashes a short "unlocked" note; landing above it with no crossing shows nothing */
function useUnlockedFlash(remaining: number | null) {
  const [flash, setFlash] = useState(false);
  const last = useRef(remaining);
  useEffect(() => {
    const crossed = last.current !== null && last.current > 0 && remaining !== null && remaining <= 0;
    last.current = remaining;
    if (!crossed) return;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), UNLOCKED_MS);
    return () => clearTimeout(timer);
  }, [remaining]);
  return flash;
}

/** Sits on the cart bar: how much more to add for free delivery, with the progress so far */
export const FreeDeliveryBar = memo(function FreeDeliveryBar({ threshold, storeId }: Props) {
  const t = useStrings("home");
  const { totalAmount, itemCount, storeId: cartStoreId } = useCart();
  const { isBasketMode } = useBasketMode();
  // Only for a cart at this store, and not while filling tomorrow's basket (its bar takes the dock)
  const active = threshold !== null && threshold > 0 && itemCount > 0 && cartStoreId === storeId && !isBasketMode;
  const remaining = active ? threshold - totalAmount : null;
  const flash = useUnlockedFlash(remaining);

  if (flash) {
    return (
      <View style={[styles.bar, styles.unlocked]} accessibilityLiveRegion="polite">
        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        <Text style={styles.unlockedText}>{t.freeDeliveryUnlocked}</Text>
      </View>
    );
  }
  if (remaining === null || remaining <= 0) return null;
  const progress = Math.min(1, totalAmount / (threshold as number));

  return (
    <View style={styles.bar} accessibilityLabel={t.unlockA11y(rupees(remaining))}>
      <View style={styles.row}>
        <Ionicons name="bicycle" size={16} color={colors.primary} />
        <Text style={styles.text} numberOfLines={1}>
          <Text style={styles.strong}>{t.unlockFreeDelivery}</Text>
          {t.shopMore(rupees(remaining))}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 16, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 10, borderRadius: 14,
    backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, gap: 7,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  strong: { fontFamily: fonts.bold, color: colors.text },
  track: { height: 4, borderRadius: 2, backgroundColor: "#ccfbf1", overflow: "hidden" },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  unlocked: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  unlockedText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
});
