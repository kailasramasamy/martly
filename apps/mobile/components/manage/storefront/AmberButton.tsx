import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";

/** The amber call to action on the ink storefront cards */
export function AmberButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.cta} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      <Ionicons name="sparkles" size={15} color={colors.accentText} />
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44,
    backgroundColor: colors.accent, borderRadius: 999,
  },
  text: { fontFamily: fonts.bold, fontSize: 14, color: colors.accentText },
});
