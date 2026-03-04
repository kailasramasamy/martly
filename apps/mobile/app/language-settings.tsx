import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize } from "../constants/theme";
import { useLanguage } from "../lib/language-context";

export default function LanguageSettingsScreen() {
  const { language, setLanguage, supportedLanguages } = useLanguage();

  return (
    <View style={styles.container}>
      <Text style={styles.description}>
        Choose a regional language for product names and categories. English will show as a subtitle.
      </Text>

      <TouchableOpacity
        style={[styles.option, !language && styles.optionSelected]}
        onPress={() => setLanguage(null)}
      >
        <View style={styles.optionContent}>
          <Text style={styles.optionLabel}>English (Default)</Text>
          <Text style={styles.optionSub}>No translations applied</Text>
        </View>
        {!language && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
      </TouchableOpacity>

      {(Object.entries(supportedLanguages) as [string, string][]).map(([code, label]) => (
        <TouchableOpacity
          key={code}
          style={[styles.option, language === code && styles.optionSelected]}
          onPress={() => setLanguage(code as any)}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionLabel}>{label}</Text>
            <Text style={styles.optionSub}>Show translated names when available</Text>
          </View>
          {language === code && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "08",
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  optionSub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
