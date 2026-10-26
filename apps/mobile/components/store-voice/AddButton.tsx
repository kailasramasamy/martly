import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useProductActions } from "../../lib/product-actions";
import { useStrings } from "../../lib/i18n/use-strings";
import type { StoreProduct } from "../../lib/types";

const HIT = { top: 8, bottom: 8, left: 6, right: 6 };

/** A post's product into the cart: "+" (or ADD when `wide`), then − n + once it's in */
/** `fill` stretches the stepper across its row, for a narrow tile with no room beside it */
export function AddButton({ sp, wide, tint, fill }: { sp: StoreProduct; wide?: boolean; tint?: string; fill?: boolean }) {
  const t = useStrings("storeVoice");
  const tc = useStrings("catalog");
  const { getLocalizedName } = useLanguage();
  const actions = useProductActions();
  const quantity = actions.cartQuantityMap.get(sp.id) ?? 0;
  if (quantity > 0) {
    return (
      <View style={[styles.stepper, fill && styles.filled, tint ? { backgroundColor: tint } : null]}>
        <TouchableOpacity style={styles.step} onPress={() => actions.updateQuantity(sp.id, quantity - 1)} hitSlop={HIT} accessibilityLabel="−">
          <Ionicons name="remove" size={15} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.count}>{quantity}</Text>
        <TouchableOpacity
          style={styles.step} onPress={() => actions.updateQuantity(sp.id, quantity + 1)} hitSlop={HIT}
          disabled={quantity >= sp.availableStock} accessibilityLabel="+"
        >
          <Ionicons name="add" size={15} color="#ffffff" />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[wide ? styles.wide : styles.round, tint ? { backgroundColor: tint, borderColor: tint } : null]} onPress={() => actions.addToCart(sp)} hitSlop={HIT}
      accessibilityRole="button" accessibilityLabel={t.add(getLocalizedName(sp.product))}
    >
      {wide ? <Text style={styles.wideText}>{tc.addBtn}</Text> : <Ionicons name="add" size={17} color={tint ? "#ffffff" : colors.primary} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  round: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  wide: { height: 34, minWidth: 68, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  wideText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.primary },
  stepper: { flexDirection: "row", alignItems: "center", height: 32, borderRadius: 16, backgroundColor: colors.primary },
  filled: { alignSelf: "stretch", justifyContent: "space-between" },
  step: { width: 28, height: 32, alignItems: "center", justifyContent: "center" },
  count: { minWidth: 16, textAlign: "center", fontFamily: fonts.extrabold, fontSize: 13, color: "#ffffff", fontVariant: ["tabular-nums"] },
});
