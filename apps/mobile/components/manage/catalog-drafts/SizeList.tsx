import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { UNIT_TYPE_OPTIONS } from "../products/options";
import { newSize, sizeError, type SizeValues } from "./sizes";

interface SizeEditorProps {
  index: number;
  value: SizeValues;
  showError: boolean;
  onChange: (patch: Partial<SizeValues>) => void;
  onRemove: () => void;
}

function SizeEditor({ index, value, showError, onChange, onRemove }: SizeEditorProps) {
  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Text style={styles.title}>Another size {index + 1}</Text>
        <TouchableOpacity onPress={onRemove} style={styles.remove} accessibilityLabel={`Remove size ${index + 1}`}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
      <TextField label="Size name" required value={value.name} onChangeText={(name) => onChange({ name })} placeholder="e.g. 5 kg"
        error={showError ? sizeError(value) : undefined} />
      <View style={styles.pair}>
        <View style={styles.half}><SelectField label="Unit" value={value.unitType} options={UNIT_TYPE_OPTIONS} onChange={(unitType) => onChange({ unitType })} /></View>
        <View style={styles.half}><TextField label="Unit value" keyboardType="decimal-pad" value={value.unitValue} onChangeText={(unitValue) => onChange({ unitValue })} /></View>
      </View>
      <View style={styles.pair}>
        <View style={styles.half}><TextField label="MRP" required prefix={"₹"} keyboardType="decimal-pad" value={value.mrp} onChangeText={(mrp) => onChange({ mrp })} /></View>
        <View style={styles.half}><TextField label="Selling price" required prefix={"₹"} keyboardType="decimal-pad" value={value.sellingPrice} onChangeText={(sellingPrice) => onChange({ sellingPrice })} /></View>
      </View>
      <TextField label="Stock" keyboardType="number-pad" value={value.stock} onChangeText={(stock) => onChange({ stock })} placeholder="0" />
    </View>
  );
}

interface SizeListProps {
  sizes: SizeValues[];
  /** Unit a new row starts with, taken from the main size */
  unitType: string;
  showErrors: boolean;
  onChange: (sizes: SizeValues[]) => void;
}

/** Extra pack sizes of one product, each with its own price and stock in this store */
export function SizeList({ sizes, unitType, showErrors, onChange }: SizeListProps) {
  return (
    <>
      {sizes.map((size, index) => (
        <SizeEditor
          key={index}
          index={index}
          value={size}
          showError={showErrors}
          onChange={(patch) => onChange(sizes.map((s, i) => (i === index ? { ...s, ...patch } : s)))}
          onRemove={() => onChange(sizes.filter((_, i) => i !== index))}
        />
      ))}
      <Button label="Add another size" icon="add" variant="secondary" onPress={() => onChange([...sizes, newSize(unitType)])} />
    </>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: manage.line, borderRadius: radius.lg, padding: 12, marginBottom: 12, backgroundColor: manage.canvas },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -8 },
  pair: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
});
