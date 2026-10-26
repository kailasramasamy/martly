import { View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";

interface StockStepperProps {
  value: string;
  onChange: (value: string) => void;
  reserved: number;
}

function StepButton({ icon, label, onPress }: { icon: "add" | "remove"; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.step} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} activeOpacity={0.7}>
      <Ionicons name={icon} size={22} color={colors.text} />
    </TouchableOpacity>
  );
}

export function StockStepper({ value, onChange, reserved }: StockStepperProps) {
  const bump = (delta: number) => onChange(String(Math.max(0, (Number(value) || 0) + delta)));
  return (
    <View>
      <Text style={styles.label}>On-hand stock</Text>
      <View style={styles.row}>
        <StepButton icon="remove" label="Decrease stock" onPress={() => bump(-1)} />
        <TextInput
          style={[styles.input, tabular]}
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          selectTextOnFocus
          accessibilityLabel="Stock quantity"
        />
        <StepButton icon="add" label="Increase stock" onPress={() => bump(1)} />
      </View>
      <Text style={[styles.hint, tabular]}>
        {reserved > 0
          ? `${Math.max(0, (Number(value) || 0) - reserved)} available to sell \u00B7 ${reserved} held for active orders`
          : "All of it is available to sell"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  step: {
    width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
    backgroundColor: manage.canvas, borderWidth: 1, borderColor: manage.line,
  },
  input: {
    flex: 1, height: 48, textAlign: "center", fontFamily: fonts.extrabold, fontSize: 20, color: colors.text,
    borderRadius: 24, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card,
  },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: manage.muted, marginTop: 6 },
});
