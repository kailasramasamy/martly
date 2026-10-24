import { View, StyleSheet } from "react-native";
import { TextField } from "../ui/TextField";
import { DateField } from "../ui/DateField";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import type { OfferMode, StoreProductDraft } from "./draft";

const MODES: { value: OfferMode; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "B1G1", label: "1 + 1" },
  { value: "B2G1", label: "2 + 1" },
  { value: "CUSTOM", label: "Custom" },
];

const PRESETS: Partial<Record<OfferMode, { offerBuy: string; offerGet: string }>> = {
  B1G1: { offerBuy: "1", offerGet: "1" },
  B2G1: { offerBuy: "2", offerGet: "1" },
};

interface OfferFieldsProps {
  draft: StoreProductDraft;
  onChange: (patch: Partial<StoreProductDraft>) => void;
}

const digits = (t: string) => t.replace(/[^0-9]/g, "").slice(0, 2);

/** Buy X get Y free chooser: presets, or custom quantities, with optional start/end dates */
export function OfferFields({ draft, onChange }: OfferFieldsProps) {
  const active = draft.offerMode !== "NONE";
  return (
    <View style={styles.fields}>
      <SegmentedTabs options={MODES} value={draft.offerMode} onChange={(offerMode) => onChange({ offerMode, ...PRESETS[offerMode] })} />
      {draft.offerMode === "CUSTOM" && (
        <View style={styles.row}>
          <View style={styles.cell}><TextField label="Buy" value={draft.offerBuy} onChangeText={(t) => onChange({ offerBuy: digits(t) })} keyboardType="number-pad" hint="1 to 10" /></View>
          <View style={styles.cell}><TextField label="Get free" value={draft.offerGet} onChangeText={(t) => onChange({ offerGet: digits(t) })} keyboardType="number-pad" hint="1 to 10" /></View>
        </View>
      )}
      {active && (
        <>
          <DateField label="Offer starts" value={draft.offerStart} onChange={(offerStart) => onChange({ offerStart })} placeholder="Immediately" />
          <DateField label="Offer ends" value={draft.offerEnd} onChange={(offerEnd) => onChange({ offerEnd })} placeholder="No end date" minDate={draft.offerStart ?? undefined} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 10 },
  row: { flexDirection: "row", gap: 12 },
  cell: { flex: 1 },
});
