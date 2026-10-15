import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { StatusPill } from "../ui/StatusPill";
import { formatINR, manage } from "../ui/tokens";
import { STOCK_STATE, stockState } from "./stock-status";
import type { StoreProductItem } from "./types";

/** Listing identity: image, brand, name, pack size, MRP, store and live stock state */
export function ListingHeader({ item, available }: { item: StoreProductItem; available: number }) {
  const image = item.variant.imageUrl ?? item.product.imageUrl ?? item.product.images[0] ?? null;
  const mrp = item.variant.mrp ? Number(item.variant.mrp) : null;
  return (
    <View style={styles.row}>
      <View style={styles.imageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : (
          <Ionicons name="image-outline" size={26} color={manage.muted} />
        )}
      </View>
      <View style={styles.text}>
        {item.product.brand ? <Text style={styles.brand} numberOfLines={1}>{item.product.brand.name}</Text> : null}
        <Text style={styles.name} numberOfLines={2}>{item.product.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.variant.name}{mrp ? ` · MRP ${formatINR(mrp)}` : ""}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>{item.store.name}</Text>
        <StatusPill {...STOCK_STATE[stockState(available)]} dot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  imageWrap: {
    width: 84, height: 84, borderRadius: radius.lg, backgroundColor: "#fff",
    borderWidth: 1, borderColor: manage.line, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  image: { width: 72, height: 72 },
  text: { flex: 1, gap: 3, alignItems: "flex-start" },
  brand: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.8, textTransform: "uppercase" },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
