import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RefundDestination } from "@martly/shared/constants";
import { colors, fontSize, spacing } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";

/** For cash-on-delivery orders the customer chooses where an approved refund goes */
export function RefundDestinationPicker({ value, onChange }: { value: RefundDestination; onChange: (v: RefundDestination) => void }) {
  const t = useStrings("orders").returns;
  const options: { value: RefundDestination; title: string; note: string }[] = [
    { value: "WALLET", title: t.toWallet, note: t.toWalletNote },
    { value: "CASH", title: t.toCash, note: t.toCashNote },
  ];
  return (
    <>
      <Text style={styles.title}>{t.refundTo}</Text>
      <View style={styles.card}>
        {options.map((o) => (
          <TouchableOpacity key={o.value} style={styles.row} onPress={() => onChange(o.value)} activeOpacity={0.7} accessibilityRole="radio" accessibilityState={{ selected: value === o.value }}>
            <Ionicons name={value === o.value ? "radio-button-on" : "radio-button-off"} size={22} color={value === o.value ? colors.primary : colors.textSecondary} />
            <View style={styles.text}>
              <Text style={styles.label}>{o.title}</Text>
              <Text style={styles.note}>{o.note}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, minHeight: 56 },
  text: { flex: 1 },
  label: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  note: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
});
