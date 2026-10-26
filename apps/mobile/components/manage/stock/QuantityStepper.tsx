import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";

interface QuantityStepperProps {
  /** Digits only; "" means not entered yet */
  value: string;
  onChange: (value: string) => void;
  min?: number;
  label: string;
  /** Shown while nothing is entered */
  placeholder?: string;
}

function Step({ icon, label, onPress }: { icon: "add" | "remove"; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.step} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </TouchableOpacity>
  );
}

/** Compact - [n] + control for row-level quantity entry */
export function QuantityStepper({ value, onChange, min = 0, label, placeholder = "–" }: QuantityStepperProps) {
  const bump = (delta: number) => onChange(String(Math.max(min, (Number(value) || 0) + delta)));
  return (
    <View style={styles.row}>
      <Step icon="remove" label={`Decrease ${label}`} onPress={() => bump(-1)} />
      <TextInput
        style={[styles.input, tabular, value === "" ? styles.inputEmpty : styles.inputFilled]}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={manage.muted}
        selectTextOnFocus
        accessibilityLabel={`${label} quantity`}
      />
      <Step icon="add" label={`Increase ${label}`} onPress={() => bump(1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  step: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: manage.canvas, borderWidth: 1, borderColor: manage.line,
  },
  input: {
    width: 56, height: 44, textAlign: "center", fontFamily: fonts.extrabold, fontSize: 17, color: colors.text,
    borderRadius: 22, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card,
  },
  // A word placeholder needs smaller type to fit the box
  inputEmpty: { fontFamily: fonts.semibold, fontSize: 13 },
  inputFilled: { borderColor: colors.primary },
});
