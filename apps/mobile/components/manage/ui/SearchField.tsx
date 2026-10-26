import { useEffect, useState } from "react";
import { View, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, type ReturnKeyTypeOptions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "./tokens";

interface SearchFieldProps {
  value: string;
  /** Called after the user pauses typing (debounced) */
  onChange: (text: string) => void;
  placeholder?: string;
  debounceMs?: number;
  onFocusChange?: (focused: boolean) => void;
  /** The keyboard's submit key; "done" when results show as you type and the key only closes the keyboard */
  returnKeyType?: ReturnKeyTypeOptions;
  /** Results are loading; with it set, a spinner stands in for the icon from the first keystroke until they arrive */
  loading?: boolean;
}

export function SearchField({ value, onChange, placeholder = "Search", debounceMs = 300, onFocusChange, returnKeyType = "search", loading }: SearchFieldProps) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), debounceMs);
    return () => clearTimeout(t);
  }, [text, value, onChange, debounceMs]);

  const searching = loading !== undefined && (loading || text !== value);

  return (
    <View style={styles.field}>
      {searching ? <ActivityIndicator size="small" color={colors.primary} style={styles.icon} /> : <Ionicons name="search" size={17} color={manage.muted} />}
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={manage.muted}
        returnKeyType={returnKeyType}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {text ? (
        <TouchableOpacity onPress={() => { setText(""); onChange(""); }} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={manage.muted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 12,
    borderRadius: radius.lg, backgroundColor: manage.card, borderWidth: 1, borderColor: manage.line,
  },
  icon: { width: 17 },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, paddingVertical: 0 },
});
