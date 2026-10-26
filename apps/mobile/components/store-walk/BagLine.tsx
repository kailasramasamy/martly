import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useCart, type CartItem } from "../../lib/cart-context";
import { useLanguage } from "../../lib/language-context";

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

interface Props {
  item: CartItem;
  /** First and last rows of an aisle's card round its corners */
  first: boolean;
  last: boolean;
  /** A new quantity for the line; 0 takes it out of the bag */
  onQuantity: (quantity: number) => void;
}

/** One line the walk put in the bag: tap for the product, − and + to change it, the bin at 1 to take it out */
export function BagLine({ item, first, last, onQuantity }: Props) {
  const { getLocalizedName } = useLanguage();
  const { storeId } = useCart();
  const open = () =>
    router.push({ pathname: "/product/[id]", params: storeId ? { id: item.productId, storeId } : { id: item.productId } });
  return (
    <View style={[styles.row, first && styles.first, last && styles.last, !last && styles.divider]}>
      <TouchableOpacity style={styles.opener} onPress={open} activeOpacity={0.7} accessibilityRole="link">
        <View style={styles.thumb}>
          {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : <Ionicons name="cube-outline" size={20} color={colors.border} />}
        </View>
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={2}>{getLocalizedName({ name: item.productName, translations: item.translations })}</Text>
          <Text style={styles.size} numberOfLines={1}>{item.variantName}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.right}>
        <Text style={styles.price}>{"₹"}{Math.round(item.price * item.quantity).toLocaleString("en-IN")}</Text>
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.step} onPress={() => onQuantity(item.quantity - 1)} hitSlop={HIT_SLOP} accessibilityRole="button">
            <Ionicons name={item.quantity === 1 ? "trash-outline" : "remove"} size={16} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.qty}>{item.quantity}</Text>
          <TouchableOpacity style={styles.step} onPress={() => onQuantity(item.quantity + 1)} hitSlop={HIT_SLOP} accessibilityRole="button">
            <Ionicons name="add" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.surface },
  first: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  last: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  opener: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  image: { width: 48, height: 48, resizeMode: "contain" },
  text: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, color: colors.text },
  size: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  right: { alignItems: "flex-end", gap: 8 },
  price: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text },
  stepper: { flexDirection: "row", alignItems: "center", height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.primary },
  step: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  qty: { minWidth: 20, textAlign: "center", fontFamily: fonts.extrabold, fontSize: 14, color: colors.primary },
});
