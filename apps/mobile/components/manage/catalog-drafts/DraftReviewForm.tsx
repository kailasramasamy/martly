import { useMemo } from "react";
import { Text, StyleSheet } from "react-native";
import type { CatalogDraftDetail } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { TaxonomyPicker } from "../taxonomy/TaxonomyPicker";
import { FOOD_TYPE_OPTIONS, UNIT_TYPE_OPTIONS } from "../products/options";
import { useBrandOptions } from "../products/use-brand-options";
import { NEW_BRAND, type ReviewValues } from "./use-review-form";
import type { DepartmentNode } from "../taxonomy/types";

interface DraftReviewFormProps {
  draft: CatalogDraftDetail;
  values: ReviewValues;
  tree: DepartmentNode[];
  onChange: (next: Partial<ReviewValues>) => void;
}

function BrandFields({ draft, values, onChange }: Pick<DraftReviewFormProps, "draft" | "values" | "onChange">) {
  const base = useBrandOptions();
  const packBrand = draft.label?.brand;
  const options = useMemo(
    () => [
      base[0],
      { value: NEW_BRAND, label: packBrand ? `Create new brand “${packBrand}”` : "Create new brand" },
      ...base.slice(1),
    ],
    [base, packBrand],
  );
  return (
    <>
      <SelectField label="Brand" value={values.brand} options={options} onChange={(brand) => onChange({ brand })} placeholder="Select brand" />
      {values.brand === NEW_BRAND && (
        <TextField label="New brand name" required value={values.newBrandName} onChangeText={(newBrandName) => onChange({ newBrandName })} />
      )}
    </>
  );
}

export function DraftReviewForm({ draft, values, tree, onChange }: DraftReviewFormProps) {
  return (
    <>
      <SectionCard title="Review & correct">
        <Text style={styles.note}>Prefilled from the label. Fix anything that looks off, then approve.</Text>
        <TextField label="Name" required value={values.name} onChangeText={(name) => onChange({ name })} />
        <BrandFields draft={draft} values={values} onChange={onChange} />
        <TaxonomyPicker tree={tree} value={values.selection} onChange={(selection) => onChange({ selection })} />
        <SelectField label="Food type" value={values.foodType} options={FOOD_TYPE_OPTIONS} onChange={(foodType) => onChange({ foodType })} placeholder="Veg / Non-veg / Vegan / Egg" />
        <TextField label="Description" multiline value={values.description} onChangeText={(description) => onChange({ description })} />
      </SectionCard>
      <SectionCard title="Size & price">
        <TextField label="Variant name" required value={values.variantName} onChangeText={(variantName) => onChange({ variantName })} hint="e.g. 500g pack" />
        <SelectField label="Unit" value={values.unitType} options={UNIT_TYPE_OPTIONS} onChange={(unitType) => onChange({ unitType })} placeholder="Select unit" />
        <TextField label="Unit value" keyboardType="decimal-pad" value={values.unitValue} onChangeText={(unitValue) => onChange({ unitValue })} />
        <TextField label="MRP" required prefix={"₹"} keyboardType="decimal-pad" value={values.mrp} onChangeText={(mrp) => onChange({ mrp })} />
        <TextField label="Selling price" required prefix={"₹"} keyboardType="decimal-pad" value={values.sellingPrice} onChangeText={(sellingPrice) => onChange({ sellingPrice })} />
        <TextField label="Stock" keyboardType="number-pad" value={values.stock} onChangeText={(stock) => onChange({ stock })} />
      </SectionCard>
    </>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
});
