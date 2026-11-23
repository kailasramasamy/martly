import { View, Text, StyleSheet } from "react-native";
import { formatCapacity, itemSizeRows } from "@martly/shared/item-size";
import { colors, fonts } from "../constants/theme";
import { useStrings } from "../lib/i18n/use-strings";
import type { Variant } from "../lib/types";

/** Size and capacity of an unpacked item such as a vessel or a mat; renders nothing for packed products */
export function ProductSize({ variant }: { variant?: Variant }) {
  const t = useStrings("catalog");
  if (!variant?.shape) return null;
  const rows = itemSizeRows({ ...variant, shape: variant.shape });
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t.product.size}</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{t.product.sizeLabels[row.label]}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
      {variant.capacityMl ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t.product.capacity}</Text>
          <Text style={styles.value}>{formatCapacity(variant.capacityMl, !!variant.capacityIsEstimate)}</Text>
        </View>
      ) : null}
      <Text style={styles.note}>{t.product.sizeNote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  value: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  note: { marginTop: 6, fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
});
