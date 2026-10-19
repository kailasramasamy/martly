import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HeroTileLayout, SectionHeaderStyle, TabRailStyle } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import { useResource } from "../../../lib/manage/use-resource";
import { RemotePicker } from "../marketing/RemotePicker";
import { ChipSelect } from "../marketing/ChipSelect";
import { Button } from "../ui/Button";
import { SelectField } from "../ui/SelectField";
import { TextField } from "../ui/TextField";
import { FieldFrame } from "../ui/FieldFrame";
import { manage } from "../ui/tokens";
import { ITEM_LIMITS, MAX_BANDS, MIN_BANDS, newKey, type FormValues } from "./form";
import { ItemsEditor } from "./ItemsEditor";

interface FieldsProps {
  values: FormValues;
  patch: (next: Partial<FormValues>) => void;
}

const HEADER_OPTIONS = [
  { value: SectionHeaderStyle.PLAIN, label: "Plain", description: "Title and See all on the page background" },
  { value: SectionHeaderStyle.BANNER, label: "Banner", description: "Tinted strip behind the title with a header image" },
  { value: SectionHeaderStyle.ARTWORK, label: "Artwork", description: "Full-width artwork above the products" },
];

const TAB_STYLE_OPTIONS = [
  { value: TabRailStyle.ICON_CARD, label: "Icon cards" },
  { value: TabRailStyle.ICON_UNDERLINE, label: "Icons with underline" },
  { value: TabRailStyle.PILL, label: "Pills" },
];

const HERO_LAYOUT_OPTIONS = [
  { value: HeroTileLayout.GRID, label: "Rows of three" },
  { value: HeroTileLayout.FEATURE, label: "One tall + four", description: "Needs 5 tiles in stock, else rows of three" },
];

const WIDE_LABELS: Record<string, string> = { EXPLORE_GRID: "Wide tile (spans two columns)", STORE_GRID: "Wide tile (fills the wide row)" };

const TINT_HINT = "Hex colour such as #0f766e";

function ProductRowFields({ values, patch }: FieldsProps) {
  return (
    <>
      <SelectField label="Header style" value={values.headerStyle} options={HEADER_OPTIONS} onChange={(headerStyle) => patch({ headerStyle: headerStyle as FormValues["headerStyle"] })} />
      <TextField label="Tint colour" value={values.tint} onChangeText={(tint) => patch({ tint })} placeholder="#0f766e" hint={TINT_HINT} autoCapitalize="none" maxLength={7} />
      <TextField label="Max products" value={values.maxProducts} onChangeText={(maxProducts) => patch({ maxProducts })} keyboardType="number-pad" hint="3 to 20" maxLength={2} />
    </>
  );
}

function PriceBandFields({ values, patch }: FieldsProps) {
  const setBand = (key: string, next: Partial<FormValues["bands"][number]>) =>
    patch({ bands: values.bands.map((b) => (b.key === key ? { ...b, ...next } : b)) });
  return (
    <>
      <TextField label="Headline" value={values.headline} onChangeText={(headline) => patch({ headline })} maxLength={40} hint="Optional line above the price bands" />
      <FieldFrame label="Price bands" hint="Leave the price empty for an open-ended band">
        <View style={styles.bands}>
          {values.bands.map((b) => (
            <View key={b.key} style={styles.bandRow}>
              <View style={styles.bandLabel}><TextField value={b.label} onChangeText={(label) => setBand(b.key, { label })} placeholder="Label" maxLength={16} /></View>
              <View style={styles.bandPrice}><TextField value={b.maxPrice} onChangeText={(maxPrice) => setBand(b.key, { maxPrice })} prefix={"₹"} placeholder="No limit" keyboardType="decimal-pad" /></View>
              <TouchableOpacity style={styles.remove} disabled={values.bands.length <= MIN_BANDS} onPress={() => patch({ bands: values.bands.filter((x) => x.key !== b.key) })} accessibilityRole="button" accessibilityLabel="Remove band">
                <Ionicons name="close-circle-outline" size={22} color={values.bands.length <= MIN_BANDS ? manage.line : colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </FieldFrame>
      <Button label="Add band" icon="add" variant="secondary" disabled={values.bands.length >= MAX_BANDS} onPress={() => patch({ bands: [...values.bands, { key: newKey(), label: "", maxPrice: "" }] })} />
    </>
  );
}

function BrandCardFields({ values, patch }: FieldsProps) {
  return (
    <>
      <RemotePicker label="Brand" required path="/api/v1/brands" value={values.brandId} onChange={(brandId) => patch({ brandId })} placeholder="Search brands" />
      <TextField label="Tint colour" value={values.tint} onChangeText={(tint) => patch({ tint })} placeholder="Brand colour" hint={`${TINT_HINT}; empty uses the brand's colour`} autoCapitalize="none" maxLength={7} />
    </>
  );
}

interface Department {
  id: string;
  name: string;
}

function CategoryDirectoryFields({ values, patch }: FieldsProps) {
  const { data } = useResource<Department[]>("/api/v1/categories/tree");
  const departments = data ?? [];
  const order = values.departmentIds.map((id) => departments.find((d) => d.id === id)?.name).filter(Boolean).join(" › ");
  return (
    <ChipSelect
      label="Departments"
      hint={order ? `Order on Home: ${order}` : "Tap departments in the order they should appear. None selected shows every department."}
      options={departments.map((d) => ({ value: d.id, label: d.name }))}
      value={values.departmentIds}
      onChange={(departmentIds) => patch({ departmentIds })}
    />
  );
}

function ItemFields({ values, patch }: FieldsProps) {
  const limits = ITEM_LIMITS[values.type!]!;
  const tabbed = values.type === "TABBED_ROW";
  return (
    <>
      {tabbed ? (
        <>
          <SelectField label="Tab style" value={values.tabStyle} options={TAB_STYLE_OPTIONS} onChange={(tabStyle) => patch({ tabStyle: tabStyle as FormValues["tabStyle"] })} />
          <TextField label="Tint colour" value={values.tint} onChangeText={(tint) => patch({ tint })} placeholder="#0f766e" hint={TINT_HINT} autoCapitalize="none" maxLength={7} />
        </>
      ) : null}
      <FieldFrame label={tabbed ? "Tabs" : "Tiles"} hint={`${limits.min} to ${limits.max} ${limits.noun}s, each opening one collection`}>
        <ItemsEditor items={values.items} onChange={(items) => patch({ items })} wideLabel={WIDE_LABELS[values.type!]} {...limits} />
      </FieldFrame>
      {tabbed ? null : <Text style={styles.note}>Tile images are generated in the admin panel</Text>}
    </>
  );
}

/** Settings specific to the section type; types without phone settings render nothing */
export function ConfigFields({ values, patch }: FieldsProps) {
  switch (values.type) {
    case "FESTIVE_HERO":
      return <SelectField label="Tile layout" value={values.tileLayout} options={HERO_LAYOUT_OPTIONS} onChange={(tileLayout) => patch({ tileLayout: tileLayout as FormValues["tileLayout"] })} />;
    case "PRODUCT_ROW": return <ProductRowFields values={values} patch={patch} />;
    case "TABBED_ROW":
    case "EXPLORE_GRID":
    case "STORE_GRID": return <ItemFields values={values} patch={patch} />;
    case "PRICE_BAND_DEALS": return <PriceBandFields values={values} patch={patch} />;
    case "BRAND_CARD": return <BrandCardFields values={values} patch={patch} />;
    case "CATEGORY_DIRECTORY": return <CategoryDirectoryFields values={values} patch={patch} />;
    default: return null;
  }
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  bands: { gap: 0 },
  bandRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bandLabel: { flex: 1 },
  bandPrice: { width: 120 },
  remove: { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
});
