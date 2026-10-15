import { useEffect, useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
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
}

export function SearchField({ value, onChange, placeholder = "Search", debounceMs = 300, onFocusChange }: SearchFieldProps) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), debounceMs);
    return () => clearTimeout(t);
  }, [text, value, onChange, debounceMs]);

  return (
    <View style={styles.field}>
      <Ionicons name="search" size={17} color={manage.muted} />
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={manage.muted}
        returnKeyType="search"
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
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, paddingVertical: 0 },
});
