import { useMemo, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../../search/BottomSheet";
import { FieldFrame, type FieldFrameProps } from "../../ui/FieldFrame";
import { fieldStyles as fs } from "../../ui/fieldStyles";
import { SearchField } from "../../ui/SearchField";
import { Button } from "../../ui/Button";
import { manage } from "../../ui/tokens";
import { colors, fonts } from "../../../../constants/theme";
import type { SelectOption } from "../../ui/OptionSheet";

interface MultiSelectFieldProps extends FieldFrameProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

/** Select field that opens a searchable checklist sheet */
export function MultiSelectField({ options, value, onChange, placeholder = "Select", ...frame }: MultiSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())), [options, q]);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const summary = value.length ? `${value.length} selected` : placeholder;

  return (
    <FieldFrame {...frame}>
      <TouchableOpacity style={[fs.box, !!frame.error && fs.boxError]} onPress={() => setOpen(true)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${frame.label ?? "Select"}: ${summary}`}>
        <Text style={[fs.text, !value.length && fs.placeholder]} numberOfLines={1}>{summary}</Text>
        <Ionicons name="chevron-down" size={18} color={manage.muted} />
      </TouchableOpacity>
      <BottomSheet flush visible={open} title={frame.label ?? "Select"} onClose={() => setOpen(false)} footer={<Button label="Done" onPress={() => setOpen(false)} />}>
        <View style={styles.search}><SearchField value={q} onChange={setQ} debounceMs={0} /></View>
        <FlatList
          keyboardDismissMode="on-drag"
          data={filtered}
          keyExtractor={(o) => o.value}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item }) => {
            const on = value.includes(item.value);
            return (
              <TouchableOpacity style={styles.option} onPress={() => toggle(item.value)} activeOpacity={0.7} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <Text style={[styles.label, on && styles.on]}>{item.label}</Text>
                <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? colors.primary : manage.muted} />
              </TouchableOpacity>
            );
          }}
        />
      </BottomSheet>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: 16, paddingBottom: 8 },
  list: { maxHeight: 420, paddingHorizontal: 16 },
  option: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  on: { color: colors.primary, fontFamily: fonts.bold },
});
