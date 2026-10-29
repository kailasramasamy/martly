import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import type { OrderSummary } from "./types";

const THUMBS = 4;
const THUMB_TINTS = ["#eff6ff", "#fef3c7", "#fce7f3", "#dcfce7"];

/** The order's first few items as product thumbnails, then a "+n" for the rest */
export function ItemThumbs({ order }: { order: OrderSummary }) {
  const rest = order.items.length - THUMBS;
  return (
    <View style={styles.thumbs}>
      {order.items.slice(0, THUMBS).map((item, i) => {
        const uri = item.variant.imageUrl ?? item.product.imageUrl;
        return (
          <View key={item.id} style={[styles.thumb, { backgroundColor: THUMB_TINTS[i % THUMB_TINTS.length] }]}>
            {uri ? <Image source={{ uri }} style={styles.thumbImg} /> : <Ionicons name="cube-outline" size={22} color="#94a3b8" />}
          </View>
        );
      })}
      {rest > 0 && (
        <View style={[styles.thumb, styles.thumbMore]}>
          <Text style={styles.thumbMoreText}>+{rest}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumbs: { flexDirection: "row", gap: 8, marginTop: 12 },
  thumb: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: "#f1f5f9", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: 44, height: 44, resizeMode: "contain", mixBlendMode: "multiply" },
  thumbMore: { backgroundColor: colors.surface },
  thumbMoreText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
});
