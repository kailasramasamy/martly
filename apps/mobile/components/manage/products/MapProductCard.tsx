import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import type { ManagedStore } from "../../../lib/manage-scope-context";
import { SectionCard } from "../ui/SectionCard";
import { SwitchRow } from "../ui/SwitchRow";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { useToast } from "../../../lib/toast-context";
import type { ProductVariant } from "./types";

interface VariantDraft {
  selected: boolean;
  price: string;
  stock: string;
}

interface MapProductCardProps {
  variants: ProductVariant[];
  stores: ManagedStore[];
  onMapped: () => void;
}

function initialDrafts(variants: ProductVariant[]): Record<string, VariantDraft> {
  return Object.fromEntries(variants.map((v) => [v.id, { selected: true, price: v.mrp != null ? String(Number(v.mrp)) : "", stock: "0" }]));
}

export function MapProductCard({ variants, stores, onMapped }: MapProductCardProps) {
  const toast = useToast();
  const { run, running } = useAction();
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState(() => initialDrafts(variants));
  const patch = (id: string, next: Partial<VariantDraft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...next } }));

  const submit = async () => {
    const chosen = variants.filter((v) => drafts[v.id].selected);
    if (storeIds.length === 0 || chosen.length === 0) return toast.show("Pick at least one store and one variant", "error");
    if (chosen.some((v) => !(Number(drafts[v.id].price) > 0))) return toast.show("Every selected variant needs a price above 0", "error");
    const items = chosen.map((v) => ({ variantId: v.id, price: Number(drafts[v.id].price), stock: Math.max(0, Math.floor(Number(drafts[v.id].stock) || 0)) }));
    const results = await run(async () => {
      const out = [];
      for (const storeId of storeIds) out.push(await api.post<{ created: number; skipped: number }>("/api/v1/store-products/bulk", { storeId, items }));
      return out;
    });
    if (!results) return;
    const created = results.reduce((n, r) => n + r.data.created, 0);
    toast.show(`${created} listing${created === 1 ? "" : "s"} created across ${storeIds.length} store(s)`, "success");
    onMapped();
  };

  return (
    <SectionCard title="Add to stores">
      {stores.map((s) => (
        <SwitchRow key={s.id} label={s.name} description={s.address} value={storeIds.includes(s.id)}
          onValueChange={(on) => setStoreIds(on ? [...storeIds, s.id] : storeIds.filter((id) => id !== s.id))} />
      ))}
      {variants.map((v) => (
        <View key={v.id} style={styles.variant}>
          <SwitchRow label={v.name} description={v.mrp != null ? `MRP ${Number(v.mrp)}` : undefined} value={drafts[v.id].selected} onValueChange={(selected) => patch(v.id, { selected })} />
          {drafts[v.id].selected && (
            <View style={styles.pair}>
              <View style={styles.half}><TextField label="Price" prefix={"₹"} keyboardType="decimal-pad" value={drafts[v.id].price} onChangeText={(price) => patch(v.id, { price })} /></View>
              <View style={styles.half}><TextField label="Stock" keyboardType="number-pad" value={drafts[v.id].stock} onChangeText={(stock) => patch(v.id, { stock })} /></View>
            </View>
          )}
        </View>
      ))}
      <Button label={`Add to ${storeIds.length} store${storeIds.length === 1 ? "" : "s"}`} onPress={submit} loading={running} disabled={storeIds.length === 0} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  variant: { marginTop: 4 },
  pair: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
});
