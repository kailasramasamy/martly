import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CartItem } from "../../lib/cart-context";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { colors, spacing, fontSize } from "../../constants/theme";
import type { LineStatus } from "./use-cart-review";

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

interface CartLineProps {
  item: CartItem;
  status: LineStatus;
  onDecrement: () => void;
  onIncrement: () => void;
  onRemove: () => void;
}

/** One cart line; notes a price the store changed, low stock, or that it can't be bought any more */
export function CartLine({ item, status, onDecrement, onIncrement, onRemove }: CartLineProps) {
  const t = useStrings("cart");
  const { getLocalizedName } = useLanguage();
  const atStockLimit = status.stockLeft != null && item.quantity >= status.stockLeft;

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <View style={status.unavailable && styles.faded}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
          ) : (
            <View style={styles.itemImagePlaceholder}>
              <Ionicons name="cube-outline" size={20} color={colors.border} />
            </View>
          )}
        </View>
        <View style={styles.cardMiddle}>
          <Text style={[styles.itemName, status.unavailable && styles.fadedText]} numberOfLines={2}>
            {getLocalizedName({ name: item.productName, translations: item.translations })}
          </Text>
          <Text style={styles.itemVariant}>{item.variantName}</Text>
          <Text style={styles.itemPrice}>{"₹"}{item.price.toFixed(0)}</Text>
          {status.unavailable ? (
            <Text style={[styles.note, styles.noteError]}>{t.outOfStock}</Text>
          ) : status.stockLeft != null ? (
            <Text style={[styles.note, styles.noteWarn]}>{t.onlyLeft(status.stockLeft)}</Text>
          ) : status.previousPrice != null ? (
            <Text style={[styles.note, styles.noteWarn]}>{t.priceChanged(status.previousPrice.toFixed(0))}</Text>
          ) : null}
        </View>
        {status.unavailable ? (
          <TouchableOpacity style={styles.removeBtn} onPress={onRemove} accessibilityRole="button">
            <Text style={styles.removeText}>{t.remove}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.cardRight}>
            <View style={styles.qtyStepper}>
              <TouchableOpacity style={styles.qtyBtn} onPress={onDecrement} hitSlop={HIT_SLOP}>
                <Ionicons name={item.quantity === 1 ? "trash-outline" : "remove"} size={16} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={onIncrement} hitSlop={HIT_SLOP} disabled={atStockLimit}>
                <Ionicons name="add" size={16} color={atStockLimit ? colors.border : colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.lineTotal}>{"₹"}{(item.price * item.quantity).toFixed(0)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { flexDirection: "row", alignItems: "center" },
  faded: { opacity: 0.4 },
  fadedText: { color: colors.textSecondary },
  itemImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.surface },
  itemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  cardMiddle: { flex: 1, marginHorizontal: 12 },
  cardRight: { alignItems: "flex-end", justifyContent: "space-between" },
  itemName: { fontSize: 15, fontWeight: "600", color: colors.text, lineHeight: 20 },
  itemVariant: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  note: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  noteWarn: { color: "#c2410c" },
  noteError: { color: colors.error },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    backgroundColor: colors.primary + "08",
    overflow: "hidden",
  },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 8, justifyContent: "center", alignItems: "center" },
  qtyText: { fontSize: fontSize.md, fontWeight: "700", color: colors.primary, minWidth: 24, textAlign: "center" },
  lineTotal: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 6 },
  removeBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  removeText: { fontSize: fontSize.md, fontWeight: "700", color: colors.error },
});
