import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { BottomSheet } from "../../search/BottomSheet";
import { manage } from "./tokens";
import { fieldStyles as fs } from "./fieldStyles";
import { FieldFrame, type FieldFrameProps } from "./FieldFrame";
import { SearchField } from "./SearchField";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectFieldProps extends FieldFrameProps {
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SEARCH_THRESHOLD = 8;

export function SelectField({ label, required, hint, error, value, options, onChange, placeholder = "Select", disabled }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(
    () => (q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options),
    [options, q],
  );
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };

  return (
    <FieldFrame label={label} required={required} hint={hint} error={error}>
      <TouchableOpacity
        style={[fs.box, !!error && fs.boxError, disabled && fs.boxDisabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? "Select"}: ${selected?.label ?? "none"}`}
      >
        <Text style={[fs.text, !selected && fs.placeholder]} numberOfLines={1}>{selected?.label ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={manage.muted} />
      </TouchableOpacity>
      <BottomSheet visible={open} title={label ?? "Select"} onClose={() => setOpen(false)}>
        {options.length > SEARCH_THRESHOLD && <View style={styles.search}><SearchField value={q} onChange={setQ} debounceMs={0} /></View>}
        <FlatList
        keyboardDismissMode="on-drag"
          data={filtered}
          keyExtractor={(o) => o.value}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.option} onPress={() => pick(item.value)} activeOpacity={0.7}>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, item.value === value && styles.optionSelected]}>{item.label}</Text>
                {item.description ? <Text style={styles.optionDesc} numberOfLines={1}>{item.description}</Text> : null}
              </View>
              {item.value === value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </TouchableOpacity>
          )}
        />
      </BottomSheet>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: 16, paddingBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  option: { flexDirection: "row", alignItems: "center", minHeight: 52, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  optionText: { flex: 1 },
  optionLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  optionSelected: { color: colors.primary, fontFamily: fonts.bold },
  optionDesc: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
});
