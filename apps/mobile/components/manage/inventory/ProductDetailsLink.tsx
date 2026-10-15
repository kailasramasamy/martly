import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { useAuth } from "../../../lib/auth-context";
import { canEditProduct } from "../products/access";
import { manage } from "../ui/tokens";
import type { StoreProductItem } from "./types";

/** A listing only holds this store's stock and price; name, images and variants live on the shared product */
export function ProductDetailsLink({ item }: { item: StoreProductItem }) {
  const router = useRouter();
  const { user } = useAuth();
  const editable = canEditProduct(user, item.product);
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/manage/products/${item.product.id}`)}
      activeOpacity={0.7}
      accessibilityRole="link"
    >
      <Ionicons name={editable ? "create-outline" : "eye-outline"} size={18} color={colors.primary} />
      <View style={styles.text}>
        <Text style={styles.title}>{editable ? "Edit product" : "View product"}</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {editable
            ? "Name, images, variants and description — shared by every store"
            : item.product.organizationId === null
              ? "Master catalog product — details are managed by Martly"
              : "Owned by the organization's catalog — its admins edit details"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={manage.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52,
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: manage.hairline,
  },
  text: { flex: 1 },
  title: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.primary },
  sub: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
