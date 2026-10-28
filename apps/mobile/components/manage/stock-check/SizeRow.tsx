import { memo } from "react";
import { View, Text, Image, Switch, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StockCheckProduct } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { formatINR, manage, tabular } from "../ui/tokens";

interface Props {
  product: StockCheckProduct;
  on: Map<string, boolean>;
  onToggle: (storeProductId: string) => void;
  /** The whole product on or off, every size at once */
  onProduct: (product: StockCheckProduct, carried: boolean) => void;
  onEdit: (product: StockCheckProduct) => void;
}

/** A product with one switch for all of it, then its sizes as chips: on means the store carries that size */
export const SizeRow = memo(function SizeRow({ product, on, onToggle, onProduct, onEdit }: Props) {
  const carried = product.sizes.some((s) => on.get(s.storeProductId));
  return (
    <View style={styles.row}>
      {product.imageUrl
        ? <Image source={{ uri: product.imageUrl }} style={[styles.photo, !carried && styles.off]} resizeMode="contain" />
        : <View style={[styles.photo, styles.empty]}><Ionicons name="image-outline" size={18} color={manage.muted} /></View>}
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={[styles.name, !carried && styles.nameOff]} numberOfLines={2}>{product.name}</Text>
          <TouchableOpacity onPress={() => onEdit(product)} hitSlop={8} style={styles.edit} accessibilityRole="button" accessibilityLabel={`Edit prices and sizes of ${product.name}`}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Switch
            value={carried} onValueChange={(v) => onProduct(product, v)}
            trackColor={{ true: colors.primary, false: manage.line }} accessibilityLabel={`${product.name} carried`}
          />
        </View>
        <View style={[styles.chips, !carried && styles.off]}>
          {product.sizes.map((s) => {
            const active = on.get(s.storeProductId) ?? false;
            return (
              <TouchableOpacity
                key={s.storeProductId} style={[styles.chip, active && styles.chipOn]} onPress={() => onToggle(s.storeProductId)}
                activeOpacity={0.75} accessibilityRole="switch" accessibilityState={{ checked: active }}
                accessibilityLabel={`${product.name} ${s.variantName}`}
              >
                <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={16} color={active ? "#fff" : manage.muted} />
                <Text style={[styles.chipText, active && styles.chipTextOn]}>{s.variantName}</Text>
                <Text style={[styles.chipPrice, tabular, active && styles.chipTextOn]}>{formatINR(s.price)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: manage.card, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  photo: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: manage.card },
  empty: { alignItems: "center", justifyContent: "center", backgroundColor: manage.hairline },
  body: { flex: 1, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  nameOff: { color: colors.textSecondary },
  edit: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.45 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.xl,
    borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  chipPrice: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  chipTextOn: { color: "#fff" },
});
