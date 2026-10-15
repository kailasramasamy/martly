import { View, Text, Switch, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { manage } from "./tokens";

interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function SwitchRow({ label, description, value, onValueChange, disabled }: SwitchRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: manage.line }}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, marginBottom: 6 },
  text: { flex: 1 },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  description: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
});
