import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";

interface HeaderActionProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** Native-header right button, e.g. "+ New" on list screens */
export function HeaderAction({ icon = "add", label, onPress, accessibilityLabel }: HeaderActionProps) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44, minWidth: 44, justifyContent: "center" },
  label: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
});
