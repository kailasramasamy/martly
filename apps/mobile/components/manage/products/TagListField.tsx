import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import { TextField } from "../ui/TextField";
import { FieldFrame } from "../ui/FieldFrame";

interface TagListFieldProps {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** Tappable quick-adds that are not yet chosen */
  suggestions?: string[];
  placeholder?: string;
}

/** Free-text tag entry with removable chips and optional quick-add suggestions */
export function TagListField({ label, value, onChange, suggestions = [], placeholder = "Type and add" }: TagListFieldProps) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  };
  const remaining = suggestions.filter((s) => !value.includes(s));

  return (
    <FieldFrame label={label}>
      {value.length > 0 && (
        <View style={styles.chips}>
          {value.map((tag) => (
            <TouchableOpacity key={tag} style={styles.chip} onPress={() => onChange(value.filter((t) => t !== tag))} accessibilityLabel={`Remove ${tag}`}>
              <Text style={styles.chipText}>{tag}</Text>
              <Ionicons name="close" size={14} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={styles.entry}>
        <View style={styles.input}>
          <TextField value={draft} onChangeText={setDraft} placeholder={placeholder} autoCapitalize="none" />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => add(draft)} accessibilityLabel={`Add ${label}`}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      {remaining.length > 0 && (
        <View style={styles.chips}>
          {remaining.map((s) => (
            <TouchableOpacity key={s} style={styles.suggestion} onPress={() => add(s)}>
              <Text style={styles.suggestionText}>+ {s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: manage.tint },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  entry: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 14 },
  input: { flex: 1, marginBottom: -14 },
  addBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  suggestion: { minHeight: 32, justifyContent: "center", paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: manage.line },
  suggestionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
