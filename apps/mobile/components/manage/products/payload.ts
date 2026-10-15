import type { ProductFormValues, VariantValues } from "./form";

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

function translations(v: ProductFormValues) {
  const name = v.taName.trim();
  const description = v.taDescription.trim();
  return name || description ? { ta: { ...(name && { name }), ...(description && { description }) } } : undefined;
}

function dayBoundary(key: string | null, end: boolean): string | null {
  return key ? new Date(`${key}T${end ? "23:59:59" : "00:00:00"}`).toISOString() : null;
}

function variantPayload(v: VariantValues) {
  return {
    ...(v.id && { id: v.id }),
    name: v.name.trim(),
    sku: orNull(v.sku),
    barcode: orNull(v.barcode),
    unitType: v.unitType,
    unitValue: Number(v.unitValue),
    mrp: numOrNull(v.mrp),
    packType: orNull(v.packType),
    discountType: v.discountType || null,
    discountValue: v.discountType ? numOrNull(v.discountValue) : null,
    discountStart: v.discountType ? dayBoundary(v.discountStart, false) : null,
    discountEnd: v.discountType ? dayBoundary(v.discountEnd, true) : null,
  };
}

function sharedFields(v: ProductFormValues) {
  return {
    name: v.name.trim(),
    description: orNull(v.description),
    imageUrl: v.imageUrl,
    subcategoryId: v.selection.subcategoryId || null,
    brandId: v.brandId || null,
    tags: v.tags,
    hsnCode: orNull(v.hsnCode),
    gstPercent: numOrNull(v.gstPercent),
    foodType: v.foodType || null,
    productType: v.productType || null,
    fssaiLicense: orNull(v.fssaiLicense),
    mfgLicenseNo: orNull(v.mfgLicenseNo),
    manufacturerName: orNull(v.manufacturerName),
    countryOfOrigin: orNull(v.countryOfOrigin),
    regulatoryMarks: v.regulatoryMarks,
    certifications: v.certifications,
    dangerWarnings: orNull(v.dangerWarnings),
    usageInstructions: orNull(v.usageInstructions),
    ingredients: orNull(v.ingredients),
    nutritionalInfo: v.nutritionalInfo.trim() ? JSON.parse(v.nutritionalInfo) : null,
    allergens: v.allergens,
    servingSize: orNull(v.servingSize),
    shelfLifeDays: numOrNull(v.shelfLifeDays),
    storageType: v.storageType || null,
    storageInstructions: orNull(v.storageInstructions),
    images: v.images,
    translations: translations(v),
  };
}

export function updatePayload(v: ProductFormValues) {
  return { ...sharedFields(v), isActive: v.isActive, variants: v.variants.map(variantPayload) };
}

/** The create schema takes optional (not nullable) fields, so empty values are dropped */
export function createPayload(v: ProductFormValues, storeIds: string[] | undefined) {
  const fields = Object.fromEntries(Object.entries(sharedFields(v)).filter(([, value]) => value !== null && value !== undefined));
  const variants = v.variants.map((variant) =>
    Object.fromEntries(Object.entries(variantPayload(variant)).filter(([, value]) => value !== null)));
  return { ...fields, variants, ...(storeIds && { storeIds }) };
}
