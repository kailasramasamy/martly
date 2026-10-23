import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, radius } from "../../../../constants/theme";

type Tone = "info" | "error";

const TONES: Record<Tone, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { bg: "#dbeafe", fg: "#1d4ed8", icon: "information-circle" },
  error: { bg: "#fee2e2", fg: "#b91c1c", icon: "alert-circle" },
};

/** Tinted banner with an icon; `action` sits under the message */
export function Notice({ tone = "info", message, action }: { tone?: Tone; message: string; action?: ReactNode }) {
  const t = TONES[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg }]}>
      <View style={styles.row}>
        <Ionicons name={t.icon} size={18} color={t.fg} />
        <Text style={[styles.text, { color: t.fg }]}>{message}</Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, padding: 12, gap: 10 },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  text: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 19 },
});
