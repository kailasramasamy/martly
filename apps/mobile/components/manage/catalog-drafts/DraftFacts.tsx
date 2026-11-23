import { View, Text, Image, StyleSheet } from "react-native";
import { formatCapacity, ITEM_SIZE_LABELS, itemSizeRows } from "@martly/shared/item-size";
import type { CatalogDraftDetail, CatalogDraftItem } from "@martly/shared/types";
import { useAuth } from "../../../lib/auth-context";
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

function ItemFacts({ draft, item }: { draft: CatalogDraftDetail; item: CatalogDraftItem }) {
  return (
    <SectionCard title="The listing">
      <KeyValue label="Name" value={draft.label?.name} />
      <KeyValue label="Material" value={item.material} />
      {itemSizeRows(item).map((row) => <KeyValue key={row.label} label={ITEM_SIZE_LABELS[row.label]} value={row.value} />)}
      <KeyValue label="Capacity" value={item.capacityMl ? formatCapacity(item.capacityMl, item.capacityIsEstimate) : null} />
      <KeyValue label="Description" value={draft.label?.description} />
      {item.sketchUrl ? <Image source={{ uri: item.sketchUrl }} style={styles.sketch} resizeMode="contain" accessibilityLabel="Size sketch" /> : null}
    </SectionCard>
  );
}

export function DraftFacts({ draft }: { draft: CatalogDraftDetail }) {
  const l = draft.label;
  if (!l) return null;
  if (draft.item) return <ItemFacts draft={draft} item={draft.item} />;
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
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return null;
  return <Text style={styles.cost}>Processing cost ${usd.toFixed(2)}</Text>;
}

const styles = StyleSheet.create({
  sketch: { marginTop: 10, width: "100%", aspectRatio: 1 },
  nutrition: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: manage.hairline },
  sub: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  notes: { marginTop: 10, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, fontStyle: "italic", color: colors.textSecondary },
  cost: { fontFamily: fonts.medium, fontSize: 11, color: manage.muted, textAlign: "center" },
});
