import { useMemo, useState } from "react";
import { Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { lineProducts, type BuiltLine } from "../../lib/cart-builder";
import { ProductList } from "../ProductList";

type Candidate = BuiltLine["candidates"][number];
type Option = { id: string; label: string };

// Chip labels drop the bracketed part: "Fortune (Adani Wilmar)" → "Fortune", "Organic Staples (Rice, Dal, Atta)" → "Organic Staples"
const short = (name: string) => name.replace(/\s*\([^)]*\)/g, "").trim() || name;
// Chips look 34 tall but take taps across 44
const CHIP_SLOP = { top: 5, bottom: 5, left: 2, right: 2 };

/** The distinct values among the candidates, in their ranked order */
function distinct(candidates: Candidate[], pick: (c: Candidate) => Option | null) {
  const seen = new Map<string, Option>();
  for (const c of candidates) {
    const o = pick(c);
    if (o && !seen.has(o.id)) seen.set(o.id, o);
  }
  return [...seen.values()];
}

/** A row of filter chips, shown only when there is more than one to choose between */
function Chips({ options, value, onChange }: { options: Option[]; value: string | null; onChange: (id: string | null) => void }) {
  const t = useStrings("search");
  if (options.length < 2) return null;
  const chip = (id: string | null, label: string) => (
    <TouchableOpacity key={id ?? "all"} style={[styles.chip, value === id && styles.chipOn]} onPress={() => onChange(id)} hitSlop={CHIP_SLOP}>
      <Text style={[styles.chipText, value === id && styles.chipTextOn]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {chip(null, t.all)}
      {options.map((o) => chip(o.id, o.label))}
    </ScrollView>
  );
}

/**
 * A line's products as the app's own product cards in a row, each on the size that fits the amount asked: ADD puts
 * it in the cart at once, its size line opens the size sheet, and a tap opens the product. Type and brand chips
 * narrow the row when the products differ.
 */
export function ChoicePicker({ line }: { line: BuiltLine }) {
  const { getLocalizedName } = useLanguage();
  const [typeId, setTypeId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const types = distinct(line.candidates, (c) => {
    const s = c.storeProduct.product.subcategory;
    return s ? { id: s.id, label: short(getLocalizedName(s)) } : null;
  });
  const ofType = line.candidates.filter((c) => !typeId || c.storeProduct.product.subcategory?.id === typeId);
  const brands = distinct(ofType, (c) => c.storeProduct.product.brand && { id: c.storeProduct.product.brand.id, label: short(c.storeProduct.product.brand.name) });
  const shown = ofType.filter((c) => !brandId || c.storeProduct.product.brand?.id === brandId);
  // Each card opens on the size worked out for the amount asked, and ADD adds that many
  const picks = useMemo(() => new Map(line.candidates.map((c) => [c.storeProduct.id, c.quantity])), [line]);
  return (
    <>
      <Chips options={types} value={typeId} onChange={(id) => { setTypeId(id); setBrandId(null); }} />
      <Chips options={brands} value={brandId} onChange={setBrandId} />
      <ProductList products={lineProducts({ ...line, candidates: shown })} layout="rail" picks={picks} contentContainerStyle={styles.rail} />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 6, paddingRight: 8, paddingVertical: 5 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5, borderColor: colors.border, justifyContent: "center", backgroundColor: "#ffffff" },
  chipOn: { borderColor: colors.primary, backgroundColor: "#ccfbf1" },
  chipText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary, maxWidth: 160 },
  chipTextOn: { color: colors.primary },
  rail: { paddingHorizontal: 0, paddingTop: 4 },
});
