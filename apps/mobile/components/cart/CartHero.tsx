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
      <BagHero items={items} trolley={carriesTrolley(items)} scale={0.5} />
      <View style={styles.store}>
        <View style={styles.row}>
          <StoreMark storeId={storeId} size={40} fallback={(
            <View style={styles.iconWrap}>
              <Ionicons name="storefront" size={20} color={colors.primary} />
            </View>
          )} />
          <Text style={styles.name} numberOfLines={2}>{storeName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.count} numberOfLines={1}>{t.itemsInCart(itemCount)}</Text>
          <TouchableOpacity style={styles.clear} onPress={onClear} hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }} accessibilityRole="button">
            <Text style={styles.clearText}>{t.clearCart}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 12,
    borderRadius: 20, backgroundColor: "#f0fdfa", borderWidth: 1, borderColor: "#ccfbf1",
  },
  store: { flex: 1, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary + "14", justifyContent: "center", alignItems: "center" },
  name: { flex: 1, fontFamily: fonts.extrabold, fontSize: 16, lineHeight: 21, color: colors.text },
  count: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  clear: { minHeight: 32, justifyContent: "center" },
  clearText: { fontSize: fontSize.md, fontWeight: "700", color: colors.error },
});
