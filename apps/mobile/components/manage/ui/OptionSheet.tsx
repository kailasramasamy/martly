import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { BottomSheet } from "../../search/BottomSheet";
import { manage, tabular } from "./tokens";
import { SearchField } from "./SearchField";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  count?: number;
}

interface OptionSheetProps {
  visible: boolean;
  title: string;
  options: SelectOption[];
  value: string | null;
  onPick: (value: string) => void;
  onClose: () => void;
}

const SEARCH_THRESHOLD = 8;

/** Bottom-sheet single-choice list; long lists get a search box */
export function OptionSheet({ visible, title, options, value, onPick, onClose }: OptionSheetProps) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => (q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options),
    [options, q],
  );
  const pick = (v: string) => {
    onPick(v);
    setQ("");
  };

  return (
    <BottomSheet flush visible={visible} title={title} onClose={onClose}>
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
            {item.count !== undefined && <Text style={[styles.count, tabular]}>{item.count}</Text>}
            {item.value === value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
          </TouchableOpacity>
        )}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: 16, paddingBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  optionText: { flex: 1 },
  optionLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  optionSelected: { color: colors.primary, fontFamily: fonts.bold },
  optionDesc: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  count: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
});
