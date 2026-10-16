import { memo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import { QuantityStepper } from "./QuantityStepper";
import type { StockCountItem } from "./types";

interface CountItemRowProps {
  item: StockCountItem;
  value: string;
  onChange: (storeProductId: string, value: string) => void;
}

/** One blind-count line: product, size and a quantity entry. System stock is never shown here. */
export const CountItemRow = memo(function CountItemRow({ item, value, onChange }: CountItemRowProps) {
  return (
    <View style={[styles.row, value !== "" && styles.counted]}>
      {item.imageUrl
        ? <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
        : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="image-outline" size={18} color={manage.muted} /></View>}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{item.productName}</Text>
        <Text style={styles.variant} numberOfLines={1}>{item.variantName}</Text>
      </View>
      <QuantityStepper value={value} onChange={(v) => onChange(item.storeProductId, v)} label={item.productName} placeholder="Count" />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 72, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: manage.card, borderBottomWidth: 1, borderBottomColor: manage.hairline,
  },
  counted: { backgroundColor: manage.tint },
  thumb: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: manage.canvas },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, color: colors.text },
  variant: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
