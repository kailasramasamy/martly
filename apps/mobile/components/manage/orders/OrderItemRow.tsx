import { View, Text, Image, StyleSheet } from "react-native";
import { RefuseReasonLabels } from "@martly/shared/constants";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { formatINR, manage, tabular } from "../ui/tokens";
import type { OrderDetailItem } from "./types";

/** One order line: thumbnail, name, variant · qty × price, line total */
export function OrderItemRow({ item }: { item: OrderDetailItem }) {
  const image = item.variant.imageUrl ?? item.product.imageUrl ?? item.product.images[0];
  return (
    <View style={styles.item}>
      {image ? <Image source={{ uri: image }} style={styles.thumb} /> : (
        <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="image-outline" size={18} color={manage.muted} /></View>
      )}
      <View style={styles.itemBody}>
        <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
        <Text style={styles.itemMeta}>{item.variant.name} · {item.quantity} × {formatINR(Number(item.unitPrice))}</Text>
        {item.freeQuantity > 0 ? <Text style={styles.free}>{item.freeQuantity} free</Text> : null}
        {item.replacesReturnId ? <Text style={styles.replacement}>Free replacement</Text> : null}
        {item.refusedQuantity > 0 ? (
          <Text style={styles.refused}>{item.refusedQuantity} handed back{item.refusedReason ? ` · ${RefuseReasonLabels[item.refusedReason]}` : ""}</Text>
        ) : null}
      </View>
      <Text style={[styles.itemTotal, tabular]}>{formatINR(Number(item.totalPrice))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  thumb: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: manage.canvas },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  itemBody: { flex: 1, minWidth: 0 },
  itemName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  itemMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  free: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.primaryDark, marginTop: 2 },
  replacement: { fontFamily: fonts.bold, fontSize: 12.5, color: "#15803d", marginTop: 2 },
  refused: { fontFamily: fonts.bold, fontSize: 12.5, color: manage.attentionText, marginTop: 2 },
  itemTotal: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
});
