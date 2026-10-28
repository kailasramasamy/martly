import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UNIT_SHORT_LABELS, variantName, type UnitType } from "@martly/shared/constants";
import type { StockCheckEditInput } from "@martly/shared/schemas";
import type { StockCheckProduct } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { formatINR, manage, tabular } from "../ui/tokens";

type Edit = Pick<StockCheckEditInput, "sizes" | "newSizes">;
type Draft = { value: string; unit: UnitType; price: string };

const UNITS: UnitType[] = ["KG", "GRAM", "PIECE", "LITER", "ML", "DOZEN", "BUNDLE", "PACK"];
const NEW_SIZE: Draft = { value: "1", unit: "KG", price: "" };
const amount = (s: string) => Number(s.replace(/[^\d.]/g, ""));

interface Props {
  product: StockCheckProduct | null;
  running: boolean;
  onSave: (edit: Edit) => void;
  onClose: () => void;
}

function PriceInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <View style={styles.price}>
      <Text style={styles.rupee}>₹</Text>
      <TextInput
        value={value} onChangeText={onChange} keyboardType="decimal-pad" selectTextOnFocus
        style={[styles.priceInput, tabular]} accessibilityLabel={label} placeholder="Price" placeholderTextColor={manage.muted}
      />
    </View>
  );
}

function NewSizeRow({ draft, onChange, onRemove }: { draft: Draft; onChange: (d: Draft) => void; onRemove: () => void }) {
  return (
    <View style={styles.newSize}>
      <View style={styles.line}>
        <TextInput
          value={draft.value} onChangeText={(value) => onChange({ ...draft, value })} keyboardType="decimal-pad" selectTextOnFocus
          style={[styles.qty, tabular]} accessibilityLabel="Quantity"
        />
        <Text style={styles.preview} numberOfLines={1}>{amount(draft.value) > 0 ? variantName(draft.unit, amount(draft.value)) : "Size"}</Text>
        <PriceInput value={draft.price} onChange={(price) => onChange({ ...draft, price })} label="New size price" />
        <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.remove} accessibilityRole="button" accessibilityLabel="Remove size">
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.units}>
        {UNITS.map((u) => (
          <TouchableOpacity key={u} style={[styles.unit, u === draft.unit && styles.unitOn]} onPress={() => onChange({ ...draft, unit: u })} accessibilityRole="button">
            <Text style={[styles.unitText, u === draft.unit && styles.unitTextOn]}>{UNIT_SHORT_LABELS[u]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/** Only prices that moved are sent, so opening the sheet to add a size doesn't switch other sizes on */
function toEdit(product: StockCheckProduct, prices: Map<string, string>, drafts: Draft[]): Edit | string {
  const sizes = product.sizes.flatMap((s) => {
    const price = amount(prices.get(s.storeProductId) ?? "");
    return price > 0 && price !== s.price ? [{ id: s.storeProductId, price }] : [];
  });
  if (drafts.some((d) => !(amount(d.value) > 0) || !(amount(d.price) > 0))) return "Enter a size and a price for each new size";
  const newSizes = drafts.map((d) => ({ unitType: d.unit, unitValue: amount(d.value), price: amount(d.price) }));
  return sizes.length + newSizes.length ? { sizes, newSizes } : "Nothing changed";
}

/** A product's sizes with their prices to fix, and new sizes the store sells; saving confirms them all as carried */
export function EditSizesSheet({ product, running, onSave, onClose }: Props) {
  const [prices, setPrices] = useState<Map<string, string>>(new Map());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setPrices(new Map(product?.sizes.map((s) => [s.storeProductId, String(s.price)]) ?? []));
    setDrafts([]);
    setError(null);
  }, [product]);
  if (!product) return null;

  const save = () => {
    const edit = toEdit(product, prices, drafts);
    if (typeof edit === "string") return setError(edit);
    onSave(edit);
  };
  const footer = <Button label="Save" icon="checkmark" loading={running} onPress={save} />;

  return (
    <BottomSheet visible title={product.name} onClose={onClose} footer={footer} scrollable>
      {product.sizes.map((s) => (
        <View key={s.storeProductId} style={styles.line}>
          <View style={styles.sizeText}>
            <Text style={styles.sizeName}>{s.variantName}</Text>
            {s.mrp !== null && <Text style={[styles.mrp, tabular]}>MRP {formatINR(s.mrp)}</Text>}
          </View>
          <PriceInput value={prices.get(s.storeProductId) ?? ""} onChange={(v) => setPrices((m) => new Map(m).set(s.storeProductId, v))} label={`${s.variantName} price`} />
        </View>
      ))}
      {drafts.map((d, i) => (
        <NewSizeRow
          key={i} draft={d} onChange={(next) => setDrafts((all) => all.map((x, j) => (j === i ? next : x)))}
          onRemove={() => setDrafts((all) => all.filter((_, j) => j !== i))}
        />
      ))}
      <TouchableOpacity style={styles.add} onPress={() => setDrafts((all) => [...all, NEW_SIZE])} accessibilityRole="button">
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.addText}>Add a size</Text>
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.hint}>Saving marks these sizes as carried at these prices.</Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  sizeText: { flex: 1 },
  sizeName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  mrp: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  price: { flexDirection: "row", alignItems: "center", width: 110, height: 44, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card },
  rupee: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textSecondary, marginRight: 4 },
  priceInput: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.text, padding: 0 },
  newSize: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  qty: { width: 64, height: 44, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: manage.line, fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  preview: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  remove: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
  units: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  unit: { minWidth: 44, height: 34, paddingHorizontal: 10, borderRadius: radius.xl, borderWidth: 1, borderColor: manage.line, alignItems: "center", justifyContent: "center" },
  unitOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  unitTextOn: { color: "#fff" },
  add: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52 },
  addText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  error: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error, marginTop: 4 },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 8 },
});
