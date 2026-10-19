import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";

interface Props {
  value: string;
  onChange: (text: string) => void;
  onCancel: () => void;
  /** The collection's ink, so Cancel matches a campaign's colours */
  accent: string;
}

/** Searches within one collection; Cancel closes it and brings the collection's header back */
export function CollectionSearchField({ value, onChange, onCancel, accent }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Search in this collection"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search in this collection"
        />
        {value ? (
          <Pressable onPress={() => onChange("")} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={onCancel} style={styles.cancel} accessibilityRole="button">
        <Text style={[styles.cancelText, { color: accent }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 14 },
  field: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, paddingVertical: 0 },
  cancel: { minHeight: 44, justifyContent: "center" },
  cancelText: { fontFamily: fonts.semibold, fontSize: 15 },
});
