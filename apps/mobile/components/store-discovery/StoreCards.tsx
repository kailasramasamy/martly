import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import type { Store } from "../../lib/types";
import { getOpenState } from "./store-info";

export function EtaChip({ minutes, onImage }: { minutes: number; onImage?: boolean }) {
  const t = useStrings("home");
  return (
    <View style={[styles.etaChip, onImage && styles.etaChipOnImage]}>
      <Ionicons name="flash" size={11} color={onImage ? colors.accentText : colors.primary} />
      <Text style={[styles.etaText, onImage && styles.etaTextOnImage]}>{t.minutes(minutes)}</Text>
    </View>
  );
}

export function OpenStatus({ store }: { store: Store }) {
  const open = getOpenState(store);
  if (!open) return null;
  return (
    <View style={styles.inlineRow}>
      <View style={[styles.statusDot, { backgroundColor: open.isOpen ? colors.success : colors.textSecondary }]} />
      <Text style={styles.metaText}>{open.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  metaText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },

  etaChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#f0fdfa", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  etaChipOnImage: { backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 5 },
  etaText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
  etaTextOnImage: { color: colors.accentText, fontSize: 13 },

});
