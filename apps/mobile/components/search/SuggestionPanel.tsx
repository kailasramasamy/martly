import { FlatList, Image, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../../constants/theme";
import type { SearchSuggestion } from "../../lib/types";

const MAX_RECENT_MATCHES = 2;
const THUMB = 40;

interface Row {
  text: string;
  imageUrl: string | null;
  recent: boolean;
}

interface SuggestionPanelProps {
  query: string;
  suggestions: SearchSuggestion[];
  recent: string[];
  onSelect: (text: string) => void;
  onFill: (text: string) => void;
}

export function suggestionRows(query: string, suggestions: SearchSuggestion[], recent: string[]): Row[] {
  const q = query.trim().toLowerCase();
  const recentRows = recent
    .filter((r) => r.toLowerCase().startsWith(q) && r.toLowerCase() !== q)
    .slice(0, MAX_RECENT_MATCHES)
    .map((text) => ({ text, imageUrl: null, recent: true }));
  const taken = new Set(recentRows.map((r) => r.text.toLowerCase()));
  return [...recentRows, ...suggestions.filter((s) => !taken.has(s.text.toLowerCase())).map((s) => ({ ...s, recent: false }))];
}

// What the customer typed stays regular and everything else is bold ("Milk|shake", "Liquid Detergent")
function HighlightedText({ text, query }: { text: string; query: string }) {
  const typed = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const words = text.split(" ");
  return (
    <Text style={styles.text} numberOfLines={1}>
      {words.map((w, i) => {
        const prefix = typed.filter((t) => w.toLowerCase().startsWith(t)).sort((a, b) => b.length - a.length)[0] ?? "";
        return (
          <Text key={i}>
            {i > 0 ? " " : ""}{w.slice(0, prefix.length)}
            <Text style={styles.bold}>{w.slice(prefix.length)}</Text>
          </Text>
        );
      })}
    </Text>
  );
}

function SuggestionRow({ row, query, onSelect, onFill }: { row: Row; query: string; onSelect: () => void; onFill: () => void }) {
  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.main} onPress={onSelect} accessibilityRole="button" accessibilityLabel={`Search ${row.text}`}>
        <View style={styles.thumb}>
          {row.imageUrl ? (
            <Image source={{ uri: row.imageUrl }} style={styles.thumbImage} resizeMode="contain" />
          ) : (
            <Ionicons name={row.recent ? "time-outline" : "search"} size={18} color={colors.textSecondary} />
          )}
        </View>
        <HighlightedText text={row.text} query={query} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.fill} onPress={onFill} accessibilityRole="button" accessibilityLabel={`Edit search as ${row.text}`}>
        <MaterialCommunityIcons name="arrow-top-left" size={20} color="#94a3b8" />
      </TouchableOpacity>
    </View>
  );
}

export function SuggestionPanel({ query, suggestions, recent, onSelect, onFill }: SuggestionPanelProps) {
  const rows = suggestionRows(query, suggestions, recent);
  return (
    <View style={styles.panel}>
      <FlatList keyboardDismissMode="on-drag"
        data={rows}
        keyExtractor={(r) => `${r.recent ? "r" : "s"}:${r.text}`}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <SuggestionRow row={item} query={query} onSelect={() => onSelect(item.text)} onFill={() => onFill(item.text)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, zIndex: 5 },
  row: { flexDirection: "row", alignItems: "center", paddingLeft: spacing.md, paddingRight: spacing.xs },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  thumbImage: { width: THUMB - 8, height: THUMB - 8, mixBlendMode: "multiply" },
  text: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  bold: { fontFamily: fonts.bold },
  fill: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
