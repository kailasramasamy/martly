import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { StatusPill } from "../ui/StatusPill";
import { formatINR, manage, tabular } from "../ui/tokens";
import { PhotoGallery } from "../inventory/PhotoGallery";
import { photosOf } from "../inventory/ProductTile";
import { CatalogPill } from "./CatalogPill";
import { DraftPill } from "./ListingPill";
import { ReadMoreText } from "./ReadMoreText";
import { FoodTypeLabels, ProductTypeLabels, StorageTypeLabels } from "@martly/shared/constants";
import type { ProductDetail } from "./types";

type Row = [label: string, value: string | null | undefined];

const label = (map: Record<string, string>, key: string | null) => (key ? map[key] ?? key : null);
const list = (items: string[] | null) => (items && items.length > 0 ? items.join(", ") : null);
const filled = (rows: Row[]) => rows.filter(([, v]) => v !== null && v !== undefined && v !== "");

const FOOD_DOT: Record<string, string> = { VEG: "#16a34a", VEGAN: "#16a34a", NON_VEG: "#b91c1c", EGG: "#d97706" };
const ACTIVE = { label: "Active", color: "#15803d", bg: "#dcfce7" };
const INACTIVE = { label: "Inactive", color: "#475569", bg: "#f1f5f9" };

function Header({ product }: { product: ProductDetail }) {
  const food = product.foodType ? { label: label(FoodTypeLabels, product.foodType) ?? "", color: FOOD_DOT[product.foodType] ?? colors.textSecondary, bg: manage.canvas } : null;
  return (
    <View style={styles.header}>
      <PhotoGallery photos={photosOf(product)} name={product.name} />
      <View style={styles.headerText}>
        {product.brand ? <Text style={styles.brand} numberOfLines={1}>{product.brand.name}</Text> : null}
        <Text style={styles.name}>{product.name}</Text>
        {product.subcategory ? <Text style={styles.category}>{product.subcategory.name}</Text> : null}
        <View style={styles.pills}>
          <CatalogPill organizationId={product.organizationId} />
          {product.isDraft ? <DraftPill /> : <StatusPill {...(product.isActive ? ACTIVE : INACTIVE)} />}
          {food && <StatusPill {...food} dot />}
        </View>
      </View>
    </View>
  );
}

function InfoCard({ title, rows }: { title: string; rows: Row[] }) {
  const shown = filled(rows);
  if (shown.length === 0) return null;
  return (
    <SectionCard title={title}>
      {shown.map(([l, v]) => <KeyValue key={l} label={l} value={v} />)}
    </SectionCard>
  );
}

function TextCard({ title, text }: { title: string; text: string | null }) {
  if (!text?.trim()) return null;
  return <SectionCard title={title}><ReadMoreText text={text} /></SectionCard>;
}

/** New products get their Tamil a few seconds after saving; until then it shows as on its way */
function TamilCard({ product }: { product: ProductDetail }) {
  const ta = product.translations?.ta;
  const pending = product.isDraft && !ta?.name;
  if (!ta?.name && !pending) return null;
  return (
    <SectionCard title="Tamil">
      {pending ? <Text style={styles.pending}>Translating…</Text> : (
        <>
          <Text style={styles.taName}>{ta?.name}</Text>
          {ta?.description ? <ReadMoreText text={ta.description} /> : null}
        </>
      )}
    </SectionCard>
  );
}

function VariantsCard({ product }: { product: ProductDetail }) {
  return (
    <SectionCard title={`Variants · ${product.variants.length}`} flush>
      {product.variants.map((v, i) => (
        <View key={v.id} style={[styles.variant, i > 0 && styles.variantDivider]}>
          <View style={styles.variantText}>
            <Text style={styles.variantName}>{v.name}</Text>
            {v.sku ? <Text style={styles.variantSku}>SKU {v.sku}</Text> : null}
          </View>
          <Text style={[styles.variantMrp, tabular]}>{v.mrp != null ? `MRP ${formatINR(Number(v.mrp), { decimals: true })}` : "No MRP"}</Text>
        </View>
      ))}
    </SectionCard>
  );
}

function nutritionRows(info: unknown): Row[] {
  if (!info || typeof info !== "object") return [];
  return Object.entries(info as Record<string, unknown>).map(([k, v]) => [k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()), String(v)]);
}

export function ProductDetailView({ product }: { product: ProductDetail }) {
  return (
    <>
      <SectionCard><Header product={product} /></SectionCard>
      <TextCard title="Description" text={product.description} />
      <TamilCard product={product} />
      <VariantsCard product={product} />
      <InfoCard title="Details" rows={[
        ["Product type", label(ProductTypeLabels, product.productType)],
        ["Storage", label(StorageTypeLabels, product.storageType)],
        ["Shelf life", product.shelfLifeDays != null ? `${product.shelfLifeDays} days` : null],
        ["Serving size", product.servingSize],
        ["Allergens", list(product.allergens)],
        ["Tags", list(product.tags)],
      ]} />
      <TextCard title="Ingredients" text={product.ingredients} />
      <InfoCard title="Nutrition" rows={nutritionRows(product.nutritionalInfo)} />
      <InfoCard title="Compliance" rows={[
        ["HSN code", product.hsnCode],
        ["GST", product.gstPercent != null ? `${Number(product.gstPercent)}%` : null],
        ["FSSAI license", product.fssaiLicense],
        ["Manufacturer", product.manufacturerName],
        ["Country of origin", product.countryOfOrigin],
        ["Regulatory marks", list(product.regulatoryMarks)],
        ["Certifications", list(product.certifications)],
      ]} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12 },
  headerText: { flex: 1, gap: 3 },
  brand: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.8, textTransform: "uppercase" },
  name: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 23, color: colors.text },
  category: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  pending: { fontFamily: fonts.medium, fontSize: 14, color: manage.muted },
  taName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginBottom: 6 },
  variant: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: 52, paddingVertical: 10 },
  variantDivider: { borderTopWidth: 1, borderTopColor: manage.hairline },
  variantText: { flex: 1 },
  variantName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  variantSku: { fontFamily: fonts.medium, fontSize: 12, color: manage.muted, marginTop: 2 },
  variantMrp: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
});
