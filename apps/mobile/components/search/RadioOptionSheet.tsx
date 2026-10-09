import { FlatList, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { BottomSheet } from "./BottomSheet";
import { colors, fonts, spacing } from "../../constants/theme";

export interface RadioOption<T extends string | null> {
  value: T;
  label: string;
  count?: number;
}

interface RadioOptionSheetProps<T extends string | null> {
  visible: boolean;
  title: string;
  options: RadioOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

export function RadioOptionSheet<T extends string | null>({ visible, title, options, selected, onSelect, onClose }: RadioOptionSheetProps<T>) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <FlatList
        data={options}
        keyExtractor={(o) => String(o.value)}
        renderItem={({ item }) => {
          const active = item.value === selected;
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => { onSelect(item.value); onClose(); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.radio, active && styles.radioActive]}>
                {active && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
              {item.count != null && <Text style={styles.count}>{item.count}</Text>}
            </TouchableOpacity>
          );
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: spacing.md, gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  label: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  labelActive: { fontFamily: fonts.bold, color: colors.primary },
  count: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
