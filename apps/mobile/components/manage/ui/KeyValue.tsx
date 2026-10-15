import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { manage, tabular } from "./tokens";

interface KeyValueProps {
  label: string;
  value: string | number | null | undefined;
  /** Bold, larger value for totals */
  emphasis?: boolean;
  valueColor?: string;
}

/** Label-left / value-right line for detail cards and money breakdowns */
const STACK_AFTER = 40;

export function KeyValue({ label, value, emphasis, valueColor }: KeyValueProps) {
  // Long text reads badly right-aligned in a narrow column, so it drops under its label instead
  const stacked = typeof value === "string" && value.length > STACK_AFTER;
  return (
    <View style={[styles.row, stacked && styles.rowStacked, emphasis && styles.rowEmphasis]}>
      <Text style={[styles.label, emphasis && styles.labelEmphasis]}>{label}</Text>
      <Text style={[styles.value, tabular, stacked && styles.valueStacked, emphasis && styles.valueEmphasis, valueColor ? { color: valueColor } : null]} selectable>
        {value === null || value === undefined || value === "" ? "—" : String(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16, paddingVertical: 6 },
  rowStacked: { flexDirection: "column", gap: 3 },
  valueStacked: { textAlign: "left", lineHeight: 20 },
  rowEmphasis: { borderTopWidth: 1, borderTopColor: manage.hairline, marginTop: 4, paddingTop: 10 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  labelEmphasis: { fontFamily: fonts.bold, color: colors.text },
  value: { flexShrink: 1, textAlign: "right", fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  valueEmphasis: { fontFamily: fonts.extrabold, fontSize: 16 },
});
