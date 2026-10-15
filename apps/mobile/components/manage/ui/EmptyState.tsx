import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "./tokens";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action && (
        <TouchableOpacity style={styles.button} onPress={action.onPress} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32 },
  iconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: manage.tint, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, textAlign: "center" },
  message: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 19 },
  button: { marginTop: 18, paddingHorizontal: 18, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: "center" },
  buttonText: { fontFamily: fonts.bold, fontSize: 14, color: "#fff" },
});
