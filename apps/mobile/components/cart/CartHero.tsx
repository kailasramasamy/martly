import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, fontSize } from "../../constants/theme";
import { useCart } from "../../lib/cart-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { BagHero } from "../store-walk/BagHero";
import { carriesTrolley } from "../store-walk/cart-look";
import { StoreMark } from "../StoreMark";

/** The top of the cart: its packs in a basket or trolley, as on the walk, beside the store they're from */
export function CartHero({ onClear }: { onClear: () => void }) {
  const t = useStrings("cart");
  const { storeId, storeName, items, itemCount } = useCart();
  return (
    <View style={styles.hero}>
      <BagHero items={items} trolley={carriesTrolley(items)} scale={0.7} />
      <View style={styles.store}>
        <StoreMark storeId={storeId} size={56} fallback={(
          <View style={styles.iconWrap}>
            <Ionicons name="storefront" size={24} color={colors.primary} />
          </View>
        )} />
        <Text style={styles.name} numberOfLines={2}>{storeName}</Text>
        <Text style={styles.count}>{t.itemsInCart(itemCount)}</Text>
        <TouchableOpacity style={styles.clear} onPress={onClear} hitSlop={{ top: 6, bottom: 6, right: 10 }} accessibilityRole="button">
          <Text style={styles.clearText}>{t.clearCart}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12,
    borderRadius: 20, backgroundColor: "#f0fdfa", borderWidth: 1, borderColor: "#ccfbf1",
  },
  store: { flex: 1, alignItems: "flex-start", gap: 2 },
  iconWrap: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.primary + "14", justifyContent: "center", alignItems: "center" },
  name: { fontFamily: fonts.extrabold, fontSize: 16, lineHeight: 21, color: colors.text, marginTop: 4 },
  count: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  clear: { minHeight: 32, justifyContent: "center" },
  clearText: { fontSize: fontSize.md, fontWeight: "700", color: colors.error },
});
