import { View, Text, StyleSheet } from "react-native";
import type { CatalogDraftDetail } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { formatINR, manage } from "../ui/tokens";

function pick(label: string | null | undefined, confidence: string | null | undefined): string | null {
  if (!label) return null;
  return confidence ? `${label} (${confidence})` : label;
}

export function DraftPicks({ draft }: { draft: CatalogDraftDetail }) {
  return (
    <SectionCard title="Our picks">
      <KeyValue label="Brand" value={pick(draft.brand?.name ?? (draft.label?.brand ? `${draft.label.brand} (new)` : null), draft.brandConfidence)} />
      <KeyValue label="Aisle" value={pick(draft.subcategory?.path, draft.subcategoryConfidence)} />
      {draft.barcodeTaken && <KeyValue label="Barcode" value="Already used by another product" valueColor={colors.error} />}
    </SectionCard>
  );
}

export function DraftFacts({ draft }: { draft: CatalogDraftDetail }) {
  const l = draft.label;
  if (!l) return null;
  return (
    <SectionCard title="Read from the pack">
      <KeyValue label="Name" value={l.name} />
      <KeyValue label="Brand on pack" value={l.brand} />
      <KeyValue label="Size" value={l.variantName} />
      <KeyValue label="Barcode" value={l.barcode} />
      <KeyValue label="Printed MRP" value={l.printedMrp ? formatINR(l.printedMrp, { decimals: true }) : null} />
      <KeyValue label="Food type" value={l.foodType} />
      <KeyValue label="FSSAI" value={l.fssaiLicense} />
      <KeyValue label="Manufacturer" value={l.manufacturerName} />
      <KeyValue label="Shelf life" value={l.shelfLifeDays ? `${l.shelfLifeDays} days` : null} />
      <KeyValue label="Ingredients" value={l.ingredients} />
      <KeyValue label="Description" value={l.description} />
      {l.nutrition.length > 0 && (
        <View style={styles.nutrition}>
          <Text style={styles.sub}>Nutrition</Text>
          {l.nutrition.map((n) => <KeyValue key={n.name} label={n.name} value={n.value} />)}
        </View>
      )}
      {l.notes ? <Text style={styles.notes}>{l.notes}</Text> : null}
    </SectionCard>
  );
}

export function CostLine({ usd }: { usd: number }) {
  return <Text style={styles.cost}>Processing cost ${usd.toFixed(2)}</Text>;
}

const styles = StyleSheet.create({
  nutrition: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: manage.hairline },
  sub: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  notes: { marginTop: 10, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, fontStyle: "italic", color: colors.textSecondary },
  cost: { fontFamily: fonts.medium, fontSize: 11, color: manage.muted, textAlign: "center" },
});
