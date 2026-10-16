import { View, Text, TextInput, TouchableOpacity, ScrollView, Keyboard, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import type { PlacePrediction } from "../../lib/use-place-search";

interface PickerSearchProps {
  query: string;
  onQuery: (text: string) => void;
  onClear: () => void;
  predictions: PlacePrediction[];
  onPick: (prediction: PlacePrediction) => void;
  onBack: () => void;
}

/** Back, search and suggestions floating over the top of the map */
export function PickerSearch({ query, onQuery, onClear, predictions, onPick, onBack }: PickerSearchProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onQuery}
          placeholder="Search area, street or landmark"
          placeholderTextColor="#94a3b8"
          returnKeyType="search"
          autoCorrect={false}
        />
        {query ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>
      {predictions.length > 0 && (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {predictions.map((p) => (
            <TouchableOpacity key={p.place_id} style={styles.row} onPress={() => { Keyboard.dismiss(); onPick(p); }} activeOpacity={0.6}>
              <Ionicons name="location-outline" size={18} color="#64748b" />
              <View style={styles.rowText}>
                <Text style={styles.main} numberOfLines={1}>{p.structured_formatting?.main_text ?? p.description}</Text>
                {p.structured_formatting?.secondary_text ? <Text style={styles.sub} numberOfLines={1}>{p.structured_formatting.secondary_text}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12 },
  bar: {
    flexDirection: "row", alignItems: "center", height: 52, borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 4,
    shadowColor: "#0f172a", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, height: 44, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  list: {
    marginTop: 8, maxHeight: 320, borderRadius: 14, backgroundColor: "#fff",
    shadowColor: "#0f172a", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  rowText: { flex: 1 },
  main: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
});
