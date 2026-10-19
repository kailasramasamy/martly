import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { RemotePicker } from "../marketing/RemotePicker";

interface CollectionFieldProps {
  label?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  required?: boolean;
  hint?: string;
}

/** Collection picker; an optional one can be cleared back to "whole store" */
export function CollectionField({ label = "Collection", value, onChange, required, hint }: CollectionFieldProps) {
  return (
    <View>
      <RemotePicker label={label} required={required} hint={hint} path="/api/v1/collections" value={value} onChange={onChange} placeholder="Select collection" />
      {!required && value ? (
        <TouchableOpacity style={styles.clear} onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button">
          <Text style={styles.clearText}>Clear collection</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clear: { marginTop: -8, marginBottom: 12, minHeight: 28, justifyContent: "center" },
  clearText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
