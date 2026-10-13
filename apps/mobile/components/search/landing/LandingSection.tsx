import type { ReactNode } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../../../constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

interface LandingSectionProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}

export function LandingSection({ title, subtitle, icon, action, children }: LandingSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        {icon && (
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={15} color={colors.primary} />
          </View>
        )}
        <View style={styles.titles}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action && (
          <TouchableOpacity style={styles.action} onPress={action.onPress} accessibilityRole="button">
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.md + 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.md, marginBottom: 10 },
  iconWrap: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  titles: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text, letterSpacing: -0.2 },
  subtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  action: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" },
  actionText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
