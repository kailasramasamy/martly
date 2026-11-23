import { View, StyleSheet } from "react-native";
import { SelectField } from "../ui/SelectField";
import { TextField } from "../ui/TextField";
import { SectionCard } from "../ui/SectionCard";
import { SwitchRow } from "../ui/SwitchRow";
import type { ShapeValue, useItemSize } from "./use-item-size";

const SHAPES: { value: ShapeValue; label: string }[] = [
  { value: "ROUND", label: "Round (tumbler, vessel, bucket)" },
  { value: "BOX", label: "Rectangular (tub, box)" },
  { value: "FLAT", label: "Flat (spoon, mat)" },
];

function Cm({ label, required, value, onChangeText }: { label: string; required?: boolean; value: string; onChangeText: (text: string) => void }) {
  return (
    <View style={styles.half}>
      <TextField label={label} required={required} suffix="cm" keyboardType="decimal-pad" value={value} onChangeText={onChangeText} />
    </View>
  );
}

export function ItemSizeFields({ form }: { form: ReturnType<typeof useItemSize> }) {
  const { shape, sizes, set } = form;
  return (
    <SectionCard title="Size">
      <SelectField label="Shape" value={shape} options={SHAPES} onChange={(next) => form.setShape(next as ShapeValue)} />
      <View style={styles.pair}>
        {shape === "ROUND" ? (
          <>
            <Cm label="Diameter at the top" required value={sizes.topDiameter} onChangeText={set("topDiameter")} />
            <Cm label="Diameter at the base" value={sizes.baseDiameter} onChangeText={set("baseDiameter")} />
          </>
        ) : (
          <>
            <Cm label="Length" required value={sizes.length} onChangeText={set("length")} />
            <Cm label="Width" required value={sizes.width} onChangeText={set("width")} />
          </>
        )}
      </View>
      {shape !== "FLAT" && <Cm label="Height" required value={sizes.height} onChangeText={set("height")} />}
      {shape !== "FLAT" && (
        <TextField
          label="Capacity marked on the item"
          suffix="ml"
          keyboardType="number-pad"
          value={form.capacity}
          onChangeText={form.setCapacity}
          error={form.capacityError}
          placeholder="Optional"
          hint={form.estimateText ? `${form.estimateText} worked out from the size, for items that hold things.` : undefined}
        />
      )}
      {shape !== "FLAT" && (
        <SwitchRow
          label="Show volume on photo"
          description="Prints the volume on the size photo, if the item holds things."
          value={form.showCapacityOnPhoto}
          onValueChange={form.setShowCapacityOnPhoto}
        />
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
});
