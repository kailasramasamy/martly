import { TouchableOpacity, Text, ActivityIndicator, Keyboard, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "./tokens";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** Smaller 36px height, for inline row actions */
  compact?: boolean;
  style?: ViewStyle;
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: "#fff", border: colors.primary },
  secondary: { bg: "#fff", fg: colors.text, border: manage.line },
  danger: { bg: "#fff", fg: colors.error, border: "#fecaca" },
  ghost: { bg: "transparent", fg: colors.primary, border: "transparent" },
};

export function Button({ label, onPress, variant = "primary", icon, loading, disabled, compact, style }: ButtonProps) {
  const v = VARIANTS[variant];
  return (
    <TouchableOpacity
      style={[styles.base, compact && styles.compact, { backgroundColor: v.bg, borderColor: v.border }, (disabled || loading) && styles.disabled, style]}
      onPress={() => {
        // Forms keep taps alive while typing (keyboardShouldPersistTaps), so close the keyboard on any action
        Keyboard.dismiss();
        onPress();
      }}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={compact ? 15 : 18} color={v.fg} />}
          <Text style={[styles.label, compact && styles.labelCompact, { color: v.fg }]} numberOfLines={1}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  compact: { height: 36, borderRadius: radius.md, paddingHorizontal: 12, gap: 6 },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.bold, fontSize: 15 },
  labelCompact: { fontSize: 13 },
});
