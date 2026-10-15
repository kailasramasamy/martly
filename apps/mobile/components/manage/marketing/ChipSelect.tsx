import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { FieldFrame, type FieldFrameProps } from "../ui/FieldFrame";
import { manage } from "../ui/tokens";
import { colors, fonts } from "../../../constants/theme";

interface ChipSelectProps extends FieldFrameProps {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

/** Wrapping toggle chips for picking several values from a short list */
export function ChipSelect({ options, value, onChange, ...frame }: ChipSelectProps) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <FieldFrame {...frame}>
      <View style={styles.wrap}>
        {options.map((o) => {
          const active = value.includes(o.value);
          return (
            <TouchableOpacity key={o.value} style={[styles.chip, active && styles.chipActive]} onPress={() => toggle(o.value)} activeOpacity={0.75} accessibilityState={{ selected: active }}>
              <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: "center", backgroundColor: manage.card, borderWidth: 1, borderColor: manage.line },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  labelActive: { color: "#fff", fontFamily: fonts.bold },
});
