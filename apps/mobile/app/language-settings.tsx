import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize } from "../constants/theme";
import { useLanguage, type LanguageCode } from "../lib/language-context";
import { useStrings } from "../lib/i18n/use-strings";
import { usesTamilFont } from "../lib/i18n/fonts";

export default function LanguageSettingsScreen() {
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const t = useStrings("language");

  return (
    <View style={styles.container}>
      <Text style={styles.description}>{t.description}</Text>

      <TouchableOpacity
        style={[styles.option, !language && styles.optionSelected]}
        onPress={() => setLanguage(null)}
      >
        <View style={styles.optionContent}>
          <Text style={styles.optionLabel}>{t.english}</Text>
          <Text style={styles.optionSub}>{t.englishSub}</Text>
        </View>
        {!language && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
      </TouchableOpacity>

      {(Object.entries(supportedLanguages) as [LanguageCode, string][]).map(([code, label]) => (
        <TouchableOpacity
          key={code}
          style={[styles.option, language === code && styles.optionSelected]}
          onPress={() => setLanguage(code)}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionLabel}>{label}</Text>
            <Text style={styles.optionSub}>{usesTamilFont(code) ? t.fullApp : t.translated}</Text>
          </View>
          {language === code && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
        </TouchableOpacity>
      ))}

      <Text style={styles.note}>{t.restartNote}</Text>
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
  note: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  optionSub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
