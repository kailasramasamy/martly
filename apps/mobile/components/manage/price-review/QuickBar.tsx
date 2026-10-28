import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";

interface Props {
  mrp: number | null;
  /** The price or MRP was edited: the button saves it; untouched, it confirms the price as is */
  changed: boolean;
  running: boolean;
  onPrice: (price: number) => void;
  onHide: () => void;
  onSave: () => void;
  canHide: boolean;
}

const PRESETS = [{ label: "MRP", off: 0 }, { label: "−5%", off: 5 }, { label: "−10%", off: 10 }];

/**
 * Rides on top of the keypad while a row is open. Presets are plain touchables, not Button, so a tap doesn't
 * close the keyboard; saving closes the row and the keypad with it.
 */
export function QuickBar({ mrp, changed, running, onPrice, onHide, onSave, canHide }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(8, insets.bottom / 3) }]}>
      {mrp !== null && PRESETS.map((p) => (
        <TouchableOpacity key={p.label} style={styles.chip} onPress={() => onPrice(Math.max(1, Math.round(mrp * (100 - p.off) / 100)))} accessibilityRole="button" accessibilityLabel={`Price ${p.label}`}>
          <Text style={styles.chipText}>{p.label}</Text>
        </TouchableOpacity>
      ))}
      {canHide && (
        <TouchableOpacity style={styles.chip} onPress={onHide} accessibilityRole="button" accessibilityLabel="Not sold here">
          <Ionicons name="eye-off-outline" size={16} color={colors.text} />
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[styles.save, running && styles.saving]} onPress={onSave} disabled={running} accessibilityRole="button" accessibilityLabel={changed ? "Save price" : "Price OK"}>
        <Ionicons name={changed ? "save-outline" : "checkmark"} size={18} color="#fff" />
        <Text style={styles.saveText}>{changed ? "Save" : "Price OK"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingTop: 8,
    backgroundColor: manage.card, borderTopWidth: 1, borderTopColor: manage.line,
  },
  chip: { minWidth: 48, height: 44, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: manage.canvas, borderWidth: 1, borderColor: manage.line, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  save: { flex: 1, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  saving: { opacity: 0.6 },
  saveText: { fontFamily: fonts.bold, fontSize: 15, color: "#fff" },
});
