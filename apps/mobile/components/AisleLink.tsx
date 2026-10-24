import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { useLanguage } from "../lib/language-context";
import { useStrings } from "../lib/i18n/use-strings";
import type { Product } from "../lib/types";

const HIT_SLOP = { top: 10, bottom: 10, left: 6, right: 6 };

/** "All <subcategory> ›": jumps from a product to the rest of its aisle */
export function AisleLink({ subcategory }: { subcategory: Product["subcategory"] }) {
  const { getLocalizedName } = useLanguage();
  const tc = useStrings("common");
  if (!subcategory) return null;
  return (
    <TouchableOpacity
      style={styles.chip}
      onPress={() => router.push({ pathname: "/category/[id]", params: { id: subcategory.id } })}
      hitSlop={HIT_SLOP}
      accessibilityRole="link"
    >
      <Text style={styles.text} numberOfLines={2}>{tc.allOf(getLocalizedName(subcategory))}</Text>
      <Ionicons name="caret-forward" size={10} color={colors.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start", maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6,
    borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
  },
  text: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, color: colors.primary },
});
