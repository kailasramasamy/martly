import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { DateField } from "../ui/DateField";
import { UNIT_TYPE_OPTIONS, PACK_TYPES } from "./options";
import type { VariantValues } from "./form";

const DISCOUNT_OPTIONS = [
  { value: "", label: "No discount" },
  { value: "FLAT", label: "Flat amount off" },
  { value: "PERCENTAGE", label: "Percentage off" },
];

interface VariantEditorProps {
  index: number;
  value: VariantValues;
  error?: string;
  /** Discount fields are shown when editing a saved product */
  showDiscount: boolean;
  onChange: (patch: Partial<VariantValues>) => void;
  onRemove?: () => void;
}

function DiscountFields({ value, onChange }: Pick<VariantEditorProps, "value" | "onChange">) {
  return (
    <>
      <SelectField label="Discount" value={value.discountType} options={DISCOUNT_OPTIONS} onChange={(discountType) => onChange({ discountType })} />
      {value.discountType !== "" && (
        <>
          <TextField label="Discount value" keyboardType="decimal-pad" prefix={value.discountType === "FLAT" ? "₹" : undefined}
            suffix={value.discountType === "PERCENTAGE" ? "%" : undefined} value={value.discountValue} onChangeText={(discountValue) => onChange({ discountValue })} />
          <DateField label="Starts" value={value.discountStart} onChange={(discountStart) => onChange({ discountStart })} placeholder="Immediately" />
          <DateField label="Ends" value={value.discountEnd} onChange={(discountEnd) => onChange({ discountEnd })} placeholder="No end date" minDate={value.discountStart ?? undefined} />
        </>
      )}
    </>
  );
}

export function VariantEditor({ index, value, error, showDiscount, onChange, onRemove }: VariantEditorProps) {
  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Text style={styles.title}>Variant {index + 1}</Text>
        {onRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.remove} accessibilityLabel={`Remove variant ${index + 1}`}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
      <TextField label="Variant name" required value={value.name} onChangeText={(name) => onChange({ name })} placeholder="e.g. 500 ml" error={error} />
      <View style={styles.pair}>
        <View style={styles.half}><SelectField label="Unit type" value={value.unitType} options={UNIT_TYPE_OPTIONS} onChange={(unitType) => onChange({ unitType })} /></View>
        <View style={styles.half}><TextField label="Unit value" keyboardType="decimal-pad" value={value.unitValue} onChangeText={(unitValue) => onChange({ unitValue })} /></View>
      </View>
      <TextField label="MRP" prefix={"₹"} keyboardType="decimal-pad" value={value.mrp} onChangeText={(mrp) => onChange({ mrp })} />
      <TextField label="SKU" value={value.sku} onChangeText={(sku) => onChange({ sku })} autoCapitalize="characters" />
      <TextField label="Barcode" value={value.barcode} onChangeText={(barcode) => onChange({ barcode })} keyboardType="number-pad" />
      <SelectField label="Pack type" value={value.packType} options={[{ value: "", label: "Not set" }, ...PACK_TYPES]} onChange={(packType) => onChange({ packType })} placeholder="Select pack type" />
      {showDiscount && <DiscountFields value={value} onChange={onChange} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: manage.line, borderRadius: radius.lg, padding: 12, marginBottom: 12, backgroundColor: manage.canvas },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -8 },
  pair: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
});
