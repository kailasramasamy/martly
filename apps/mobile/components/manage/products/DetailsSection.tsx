import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { STORAGE_TYPE_OPTIONS } from "./options";
import { TagListField } from "./TagListField";
import type { SectionProps } from "./sections";

const COMMON_ALLERGENS = ["Gluten", "Milk", "Eggs", "Tree Nuts", "Peanuts", "Soy", "Fish", "Shellfish", "Sesame", "Mustard", "Celery", "Sulphites"];

export function DetailsSection({ values, onChange, errors }: SectionProps) {
  return (
    <SectionCard title="Product details">
      <TextField label="Ingredients" multiline value={values.ingredients} onChangeText={(ingredients) => onChange({ ingredients })} hint="Ingredient list from the pack label" />
      <TextField label="Nutritional info (JSON)" multiline value={values.nutritionalInfo} error={errors.nutritionalInfo} autoCapitalize="none"
        onChangeText={(nutritionalInfo) => onChange({ nutritionalInfo })} placeholder='{"energy":"250kcal","protein":"8g"}' />
      <TagListField label="Allergens" value={values.allergens} onChange={(allergens) => onChange({ allergens })} suggestions={COMMON_ALLERGENS} />
      <TextField label="Serving size" value={values.servingSize} onChangeText={(servingSize) => onChange({ servingSize })} placeholder='e.g. "30g"' />
      <TextField label="Shelf life" suffix="days" keyboardType="number-pad" value={values.shelfLifeDays} onChangeText={(shelfLifeDays) => onChange({ shelfLifeDays })} />
      <SelectField label="Storage type" value={values.storageType} options={[{ value: "", label: "Not set" }, ...STORAGE_TYPE_OPTIONS]}
        onChange={(storageType) => onChange({ storageType })} placeholder="Select storage type" />
      <TextField label="Storage instructions" multiline value={values.storageInstructions} onChangeText={(storageInstructions) => onChange({ storageInstructions })} />
    </SectionCard>
  );
}
