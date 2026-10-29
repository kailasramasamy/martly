import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../../constants/theme";
import { TextField } from "../../ui/TextField";
import { SelectField } from "../../ui/SelectField";
import { Button } from "../../ui/Button";
import { LANGUAGE_OPTIONS } from "./languages";

export interface PhraseDraft { key: string; language: string; text: string }

export const MAX_PHRASES = 30;

export const newPhrase = (): PhraseDraft => ({ key: Math.random().toString(36).slice(2), language: "ta", text: "" });

interface Props {
  phrases: PhraseDraft[];
  onChange: (phrases: PhraseDraft[]) => void;
  error?: string;
}

/** One language + phrase pair per row, with an add button */
export function PhraseRows({ phrases, onChange, error }: Props) {
  const patch = (key: string, change: Partial<PhraseDraft>) => onChange(phrases.map((p) => (p.key === key ? { ...p, ...change } : p)));
  return (
    <>
      {phrases.map((p) => (
        <View key={p.key} style={styles.row}>
          <View style={styles.language}>
            <SelectField label="Language" value={p.language} options={LANGUAGE_OPTIONS} onChange={(language) => patch(p.key, { language })} />
          </View>
          <View style={styles.text}>
            <TextField label="Phrase" value={p.text} onChangeText={(text) => patch(p.key, { text })} maxLength={80} placeholder="Native script or romanised" />
          </View>
          <TouchableOpacity style={styles.remove} onPress={() => onChange(phrases.filter((x) => x.key !== p.key))} accessibilityRole="button" accessibilityLabel="Remove phrase">
            <Ionicons name="close-circle-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      ))}
      <Button label="Add phrase" variant="secondary" icon="add" disabled={phrases.length >= MAX_PHRASES} onPress={() => onChange([...phrases, newPhrase()])} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  language: { width: 120 },
  text: { flex: 1 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  error: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.error },
});
