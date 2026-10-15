import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { manage } from "../ui/tokens";
import { ProductPickerSheet } from "../products/ProductPickerSheet";
import type { IngredientValues } from "./form";

interface IngredientsCardProps {
  items: IngredientValues[];
  onChange: (next: IngredientValues[]) => void;
}

/** Ingredients mapped to catalog products; each carries a display quantity and optional note */
export function IngredientsCard({ items, onChange }: IngredientsCardProps) {
  const [picking, setPicking] = useState(false);
  const patch = (index: number, next: Partial<IngredientValues>) => onChange(items.map((it, i) => (i === index ? { ...it, ...next } : it)));

  return (
    <SectionCard title={`Ingredients (${items.length})`}>
      {items.map((item, i) => (
        <View key={item.productId} style={styles.item}>
          <View style={styles.head}>
            <Text style={styles.name} numberOfLines={2}>{item.productName}</Text>
            <TouchableOpacity style={styles.remove} onPress={() => onChange(items.filter((_, j) => j !== i))} accessibilityLabel={`Remove ${item.productName}`}>
              <Ionicons name="close-circle-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          </View>
          <View style={styles.pair}>
            <View style={styles.qty}><TextField label="Quantity" required value={item.displayQty} onChangeText={(displayQty) => patch(i, { displayQty })} placeholder="e.g. 500 g" /></View>
            <View style={styles.note}><TextField label="Note" value={item.note} onChangeText={(note) => patch(i, { note })} placeholder="Optional" /></View>
          </View>
        </View>
      ))}
      <Button label="Add ingredient" icon="add" variant="secondary" onPress={() => setPicking(true)} />
      <ProductPickerSheet
        visible={picking}
        title="Pick an ingredient"
        pickedIds={items.map((i) => i.productId)}
        onClose={() => setPicking(false)}
        onPick={(p) => {
          if (!items.some((i) => i.productId === p.id)) onChange([...items, { productId: p.id, productName: p.name, displayQty: "", note: "" }]);
          setPicking(false);
        }}
      />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  item: { borderBottomWidth: 1, borderBottomColor: manage.hairline, marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "center" },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pair: { flexDirection: "row", gap: 10 },
  qty: { flex: 2 },
  note: { flex: 3 },
});
