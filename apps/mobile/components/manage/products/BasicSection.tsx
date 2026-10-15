import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField, type SelectOption } from "../ui/SelectField";
import { SwitchRow } from "../ui/SwitchRow";
import { TaxonomyPicker } from "../taxonomy/TaxonomyPicker";
import type { DepartmentNode } from "../taxonomy/types";
import { FOOD_TYPE_OPTIONS, PRODUCT_TYPE_OPTIONS } from "./options";
import { TagListField } from "./TagListField";
import type { SectionProps } from "./sections";

interface BasicSectionProps extends SectionProps {
  tree: DepartmentNode[];
  brandOptions: SelectOption[];
  showActive: boolean;
}

const withNone = (options: SelectOption[], label: string): SelectOption[] => [{ value: "", label }, ...options];

export function BasicSection({ values, onChange, errors, tree, brandOptions, showActive }: BasicSectionProps) {
  return (
    <SectionCard title="Basic information">
      <TextField label="Name" required value={values.name} onChangeText={(name) => onChange({ name })} error={errors.name} />
      <SelectField label="Brand" value={values.brandId} options={brandOptions} onChange={(brandId) => onChange({ brandId })} placeholder="Select brand" />
      <TaxonomyPicker tree={tree} value={values.selection} onChange={(selection) => onChange({ selection })} />
      <SelectField label="Product type" value={values.productType} options={withNone(PRODUCT_TYPE_OPTIONS, "Not set")}
        onChange={(productType) => onChange({ productType })} placeholder="Select product type" />
      <SelectField label="Food type" value={values.foodType} options={withNone(FOOD_TYPE_OPTIONS, "Not set")}
        onChange={(foodType) => onChange({ foodType })} placeholder="Veg / Non-veg / Vegan / Egg" />
      <TextField label="Description" multiline value={values.description} onChangeText={(description) => onChange({ description })} />
      <TagListField label="Tags" value={values.tags} onChange={(tags) => onChange({ tags })} placeholder="e.g. organic" />
      {showActive && <SwitchRow label="Active" description="Inactive products are hidden from shoppers" value={values.isActive} onValueChange={(isActive) => onChange({ isActive })} />}
    </SectionCard>
  );
}
