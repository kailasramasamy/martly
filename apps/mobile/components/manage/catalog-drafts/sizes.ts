import type { CatalogDraftSizeInput } from "@martly/shared/schemas";

export interface SizeValues {
  name: string;
  unitType: string;
  unitValue: string;
  mrp: string;
  sellingPrice: string;
  stock: string;
}

export const newSize = (unitType: string): SizeValues => ({ name: "", unitType, unitValue: "", mrp: "", sellingPrice: "", stock: "" });

/** What's missing or wrong in a size row, so the reviewer sees it before the API refuses it */
export function sizeError(v: SizeValues): string | undefined {
  if (!v.name.trim()) return "Name this size, e.g. 5 kg";
  if (!v.unitType || !(Number(v.unitValue) > 0)) return "Set the unit and its value";
  if (!(Number(v.mrp) > 0) || !(Number(v.sellingPrice) > 0)) return "Enter MRP and selling price";
  if (Number(v.sellingPrice) > Number(v.mrp)) return "Selling price can't be above MRP";
  return undefined;
}

export const toSizePayload = (v: SizeValues): CatalogDraftSizeInput => ({
  name: v.name.trim(),
  unitType: v.unitType as CatalogDraftSizeInput["unitType"],
  unitValue: Number(v.unitValue),
  mrp: Number(v.mrp),
  sellingPrice: Number(v.sellingPrice),
  stock: v.stock.trim() === "" ? 0 : Math.floor(Number(v.stock)),
});
