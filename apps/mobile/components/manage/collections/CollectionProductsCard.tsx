import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { Button } from "../ui/Button";
import { manage } from "../ui/tokens";
import { ProductPickerSheet } from "../products/ProductPickerSheet";
import type { ProductListItem } from "../products/types";

interface CollectionProductsCardProps {
  products: ProductListItem[];
  onChange: (next: ProductListItem[]) => void;
}

function IconButton({ icon, onPress, disabled, label, danger }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; label: string; danger?: boolean }) {
  return (
    <TouchableOpacity style={[styles.iconBtn, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={danger ? colors.error : colors.text} />
    </TouchableOpacity>
  );
}

/** Ordered product list with up/down/remove controls and a search sheet to add more */
export function CollectionProductsCard({ products, onChange }: CollectionProductsCardProps) {
  const [picking, setPicking] = useState(false);
  const move = (index: number, delta: number) => {
    const next = [...products];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  const toggle = (product: ProductListItem) =>
    onChange(products.some((p) => p.id === product.id) ? products.filter((p) => p.id !== product.id) : [...products, product]);

  return (
    <SectionCard title={`Products (${products.length})`} flush>
      {products.map((p, i) => (
        <View key={p.id} style={styles.item}>
          <View style={styles.row}><ListRow title={p.name} subtitle={p.brand?.name} imageUrl={p.imageUrl} /></View>
          <IconButton icon="chevron-up" label={`Move ${p.name} up`} disabled={i === 0} onPress={() => move(i, -1)} />
          <IconButton icon="chevron-down" label={`Move ${p.name} down`} disabled={i === products.length - 1} onPress={() => move(i, 1)} />
          <IconButton icon="close-circle-outline" label={`Remove ${p.name}`} danger onPress={() => onChange(products.filter((x) => x.id !== p.id))} />
        </View>
      ))}
      {products.length === 0 && <Text style={styles.empty}>No products yet</Text>}
      <View style={styles.add}><Button label="Add products" icon="add" variant="secondary" onPress={() => setPicking(true)} /></View>
      <ProductPickerSheet visible={picking} title="Add products" onClose={() => setPicking(false)} onPick={toggle} pickedIds={products.map((p) => p.id)} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: manage.hairline },
  row: { flex: 1 },
  iconBtn: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.3 },
  empty: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, padding: 14 },
  add: { padding: 14 },
});
