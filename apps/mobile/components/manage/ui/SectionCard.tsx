import type { ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from "react-native";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "./tokens";

interface SectionCardProps {
  title?: string;
  /** Right-aligned header link, e.g. "View all" */
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  /** Remove inner padding so list rows can run edge to edge */
  flush?: boolean;
  style?: ViewStyle;
}

export function SectionCard({ title, action, children, flush, style }: SectionCardProps) {
  return (
    <View style={[styles.card, style]}>
      {(title || action) && (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : <View />}
          {action && (
            <TouchableOpacity onPress={action.onPress} hitSlop={12} accessibilityRole="button">
              <Text style={styles.action}>{action.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={flush ? undefined : styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  title: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.9, textTransform: "uppercase" },
  action: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  body: { padding: 14, paddingTop: 8 },
});
