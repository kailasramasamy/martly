import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { SetupSheet, type ListSettings } from "./SetupSheet";

interface Props {
  failed: boolean;
  onRetry: () => void;
  onCreate: (settings: ListSettings) => Promise<boolean>;
}

/** No list at this store yet: start one from the shopper's biggest recent order (or say the list couldn't load) */
export function MonthlyListEmpty({ failed, onRetry, onCreate }: Props) {
  const t = useStrings("monthlyList");
  const [setup, setSetup] = useState(false);
  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.icon}><Ionicons name="reader-outline" size={30} color={colors.primary} /></View>
        <Text style={styles.title}>{t.emptyTitle}</Text>
        <Text style={styles.text}>{failed ? t.loadFailed : t.emptyBody}</Text>
        <TouchableOpacity style={styles.start} onPress={failed ? onRetry : () => setSetup(true)} accessibilityRole="button">
          <Text style={styles.startText}>{failed ? t.retry : t.startFromOrder}</Text>
        </TouchableOpacity>
        {!failed && <Text style={styles.hint}>{t.startHint}</Text>}
      </View>
      <SetupSheet visible={setup} initial={null} editing={false} replaces={false} onSave={onCreate} onClose={() => setSetup(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: colors.surface },
  card: { alignItems: "center", gap: 12, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: "#ffffff" },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, textAlign: "center" },
  text: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: "#475569", textAlign: "center" },
  start: { alignSelf: "stretch", marginTop: 4, height: 52, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  startText: { fontFamily: fonts.extrabold, fontSize: 16, color: "#ffffff" },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, textAlign: "center" },
});
