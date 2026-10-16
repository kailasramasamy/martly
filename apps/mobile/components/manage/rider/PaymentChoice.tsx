import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";

export type CollectedVia = "CASH" | "UPI";

const OPTIONS: { value: CollectedVia; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "CASH", label: "Cash", hint: "You hand it over at the store", icon: "cash-outline" },
  { value: "UPI", label: "UPI", hint: "Paid straight to the store's account", icon: "qr-code-outline" },
];

/** How a COD customer paid at the door: cash the rider carries back, or UPI to the store */
export function PaymentChoice({ value, onChange }: { value: CollectedVia; onChange: (via: CollectedVia) => void }) {
  return (
    <View style={styles.list}>
      {OPTIONS.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.option, on && styles.optionOn]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Ionicons name={o.icon} size={24} color={on ? colors.primary : colors.textSecondary} />
            <View style={styles.text}>
              <Text style={styles.label}>{o.label}</Text>
              <Text style={styles.hint}>{o.hint}</Text>
            </View>
            <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? colors.primary : "#cbd5e1"} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, marginTop: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border },
  optionOn: { borderColor: colors.primary, backgroundColor: "#f0fdfa" },
  text: { flex: 1 },
  label: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
});
