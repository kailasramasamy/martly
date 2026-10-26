import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";

// Searches once the typing pauses, not on every key
const SEARCH_DELAY_MS = 300;

interface Props {
  /** The shelf's heading: "Popular in this aisle", or the picked subcategory */
  title: string;
  /** What the search runs over: the aisle, or the picked subcategory and brand */
  scope: string;
  onQuery: (q: string) => void;
  /** The field opened or closed; open, the shelves scroll it to the top so results show above the keyboard */
  onOpenChange: (open: boolean) => void;
}

/** The shelf heading with a search beside it; open, the field takes the row and searches only the shelves on show */
export function ShelfSearch({ title, scope, onQuery, onOpenChange }: Props) {
  const t = useStrings("storeWalk");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const change = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onQuery(value.trim()), SEARCH_DELAY_MS);
  };
  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    setText("");
    setOpen(false);
    onOpenChange(false);
    onQuery("");
  };

  if (!open) {
    return (
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity style={styles.icon} onPress={() => {
          setOpen(true);
          onOpenChange(true);
        }} accessibilityRole="button" accessibilityLabel={t.searchIn(scope)}>
          <Ionicons name="search" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={[styles.row, styles.field]}>
      <Ionicons name="search" size={18} color={colors.textSecondary} />
      <TextInput
        style={styles.input} value={text} onChangeText={change} autoFocus returnKeyType="search"
        placeholder={t.searchIn(scope)} placeholderTextColor={colors.textSecondary} autoCorrect={false}
      />
      <TouchableOpacity style={styles.icon} onPress={close} accessibilityRole="button" accessibilityLabel={t.clearSearch}>
        <Ionicons name="close" size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

/** Nothing on these shelves matches: say so, and offer the whole store */
export function NoShelfMatches({ query }: { query: string }) {
  const t = useStrings("storeWalk");
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{t.noShelfMatches(query)}</Text>
      <TouchableOpacity style={styles.whole} onPress={() => router.push({ pathname: "/search", params: { q: query } })} accessibilityRole="button">
        <Text style={styles.wholeText}>{t.searchWholeStore}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  title: { flex: 1, fontFamily: fonts.extrabold, fontSize: 15, color: colors.text },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  field: { paddingLeft: 12, borderRadius: 22, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#ffffff" },
  input: { flex: 1, height: 44, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  empty: { alignItems: "center", gap: 12, paddingVertical: 24 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  whole: { height: 44, paddingHorizontal: 20, borderRadius: 22, borderWidth: 1.5, borderColor: colors.primary, justifyContent: "center" },
  wholeText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
});
