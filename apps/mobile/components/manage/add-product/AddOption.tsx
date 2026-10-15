import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";

interface AddOptionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  /** Tinted icon tile for the suggested path */
  featured?: boolean;
}

/** One tappable way to add a product: icon tile, title, one-line explanation */
export function AddOption({ icon, title, description, onPress, featured }: AddOptionProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={description}>
      <View style={[styles.tile, featured && styles.tileFeatured]}>
        <Ionicons name={icon} size={22} color={featured ? "#ffffff" : colors.primary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={manage.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, paddingHorizontal: 14, paddingVertical: 12 },
  tile: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: manage.tint, alignItems: "center", justifyContent: "center" },
  tileFeatured: { backgroundColor: colors.primary },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  description: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});
