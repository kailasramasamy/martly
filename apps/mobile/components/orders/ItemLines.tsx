import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { OrderSummary } from "./types";

const SHOWN = 2;

/** The order's first few items as rows (picture, name, pack size and how many), then "+n more" for the rest */
export function ItemLines({ order }: { order: OrderSummary }) {
  const t = useStrings("orders").card;
  const { getLocalizedName } = useLanguage();
  const rest = order.items.length - SHOWN;
  return (
    <View style={styles.list}>
      {order.items.slice(0, SHOWN).map((item) => {
        const uri = item.variant.imageUrl ?? item.product.imageUrl;
        return (
          <View key={item.id} style={styles.row}>
            <View style={styles.thumb}>
              {uri ? <Image source={{ uri }} style={styles.thumbImg} /> : <Ionicons name="cube-outline" size={18} color="#94a3b8" />}
            </View>
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>{getLocalizedName(item.product)}</Text>
              <Text style={styles.meta}>{item.variant.name} · ×{item.quantity}</Text>
            </View>
          </View>
        );
      })}
      {rest > 0 && <Text style={styles.more}>{t.moreItems(rest)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: 34, height: 34, resizeMode: "contain" },
  text: { flex: 1 },
  name: { fontSize: 13.5, fontFamily: fonts.semibold, color: colors.text },
  meta: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 1 },
  more: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary, marginLeft: 50 },
});
