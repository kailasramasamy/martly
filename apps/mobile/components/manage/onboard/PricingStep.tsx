import { View, FlatList, StyleSheet } from "react-native";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import type { PickedVariant } from "./types";

interface PricingStepProps {
  picked: PickedVariant[];
  defaultStock: string;
  onDefaultStock: (v: string) => void;
  onApplyStock: () => void;
  onPatch: (variantId: string, next: Partial<PickedVariant>) => void;
}

function PricingRow({ item, onPatch }: { item: PickedVariant; onPatch: PricingStepProps["onPatch"] }) {
  return (
    <SectionCard title={`${item.productName} · ${item.variantName}`}>
      <View style={styles.pair}>
        <View style={styles.half}>
          <TextField label="Price" prefix={"₹"} keyboardType="decimal-pad" value={item.price} onChangeText={(price) => onPatch(item.variantId, { price })}
            hint={item.mrp ? `MRP ${item.mrp}` : "No MRP set"} />
        </View>
        <View style={styles.half}>
          <TextField label="Stock" keyboardType="number-pad" value={item.stock} onChangeText={(stock) => onPatch(item.variantId, { stock })} />
        </View>
      </View>
    </SectionCard>
  );
}

export function PricingStep({ picked, defaultStock, onDefaultStock, onApplyStock, onPatch }: PricingStepProps) {
  const header = (
    <SectionCard title="Defaults">
      <TextField label="Stock for every variant" keyboardType="number-pad" value={defaultStock} onChangeText={onDefaultStock} hint="Prices start at MRP; edit any row below" />
      <Button label="Apply stock to all" variant="secondary" onPress={onApplyStock} />
    </SectionCard>
  );
  return (
    <FlatList
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      data={picked}
      keyExtractor={(p) => p.variantId}
      contentContainerStyle={styles.content}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState icon="pricetag-outline" title="Nothing selected" message="Go back and pick some variants." />}
      renderItem={({ item }) => <PricingRow item={item} onPatch={onPatch} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  pair: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
});
