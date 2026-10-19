import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";

interface Props {
  onPress: () => void;
  /** e.g. "See all 48 products"; defaults to "See all" */
  label?: string;
}

/** Full-width pill under a section that opens everything behind it */
export const SeeAllButton = memo(function SeeAllButton({ onPress, label = "See all" }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Text style={styles.text}>{label}</Text>
      <Ionicons name="caret-forward" size={11} color={colors.primary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginHorizontal: 16, marginTop: 6, minHeight: 44, borderRadius: 22,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.surface },
  text: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
});
