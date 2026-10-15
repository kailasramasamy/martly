import {
  FoodTypeLabels, ProductTypeLabels, StorageTypeLabels, UnitTypeLabels, UnitType,
} from "@martly/shared/constants";
import type { SelectOption } from "../ui/SelectField";

function fromLabels(labels: Record<string, string>): SelectOption[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

export const FOOD_TYPE_OPTIONS = fromLabels(FoodTypeLabels);
export const PRODUCT_TYPE_OPTIONS = fromLabels(ProductTypeLabels);
export const STORAGE_TYPE_OPTIONS = fromLabels(StorageTypeLabels);
export const UNIT_TYPE_OPTIONS = fromLabels(UnitTypeLabels);

export const GST_OPTIONS: SelectOption[] = [0, 5, 12, 18, 28].map((n) => ({ value: String(n), label: `${n}%` }));

export const PACK_TYPES = [
  "Pouch", "Box", "Bottle", "Can", "Jar", "Sachet", "Packet", "Bag", "Carton", "Tin", "Tube",
  "Blister Pack", "Wrapper", "Tray", "Cup", "Tetra Pack", "Stand-up Pouch", "Squeeze Bottle", "Spray Bottle", "Tub",
].map((p) => ({ value: p, label: p }));

/** The API returns short unit labels ("kg", "pcs"); forms and writes need the enum value */
const UNIT_LABEL_TO_ENUM: Record<string, string> = {
  kg: "KG", g: "GRAM", l: "LITER", ml: "ML", pcs: "PIECE", pack: "PACK", doz: "DOZEN", bundle: "BUNDLE",
};

export function normalizeUnitType(value: string): string {
  if (value in UnitType) return value;
  return UNIT_LABEL_TO_ENUM[value.toLowerCase()] ?? UnitType.PIECE;
}
