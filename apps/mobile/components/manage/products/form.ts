import type { TaxonomySelection } from "../taxonomy/types";
import { EMPTY_SELECTION } from "../taxonomy/types";
import { toDateKey } from "../ui/dates";
import { normalizeUnitType } from "./options";
import type { ProductDetail, ProductVariant } from "./types";

export interface VariantValues {
  /** Present for saved variants; absent for ones added in this session */
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  unitType: string;
  unitValue: string;
  mrp: string;
  packType: string;
  discountType: string;
  discountValue: string;
  discountStart: string | null;
  discountEnd: string | null;
}

export interface ProductFormValues {
  name: string;
  brandId: string;
  description: string;
  selection: TaxonomySelection;
  productType: string;
  foodType: string;
  isActive: boolean;
  tags: string[];
  imageUrl: string | null;
  images: string[];
  hsnCode: string;
  gstPercent: string;
  fssaiLicense: string;
  mfgLicenseNo: string;
  manufacturerName: string;
  countryOfOrigin: string;
  regulatoryMarks: string[];
  certifications: string[];
  dangerWarnings: string;
  usageInstructions: string;
  ingredients: string;
  nutritionalInfo: string;
  allergens: string[];
  servingSize: string;
  shelfLifeDays: string;
  storageType: string;
  storageInstructions: string;
  taName: string;
  taDescription: string;
  variants: VariantValues[];
  storeIds: string[];
}

export function newVariant(): VariantValues {
  return {
    name: "", sku: "", barcode: "", unitType: "PIECE", unitValue: "1", mrp: "", packType: "",
    discountType: "", discountValue: "", discountStart: null, discountEnd: null,
  };
}

export function emptyProductForm(): ProductFormValues {
  return {
    name: "", brandId: "", description: "", selection: EMPTY_SELECTION, productType: "", foodType: "",
    isActive: true, tags: [], imageUrl: null, images: [], hsnCode: "", gstPercent: "", fssaiLicense: "",
    mfgLicenseNo: "", manufacturerName: "", countryOfOrigin: "", regulatoryMarks: [], certifications: [],
    dangerWarnings: "", usageInstructions: "", ingredients: "", nutritionalInfo: "", allergens: [],
    servingSize: "", shelfLifeDays: "", storageType: "", storageInstructions: "", taName: "", taDescription: "",
    variants: [{ ...newVariant(), name: "Default" }], storeIds: [],
  };
}

const text = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const dateKey = (iso: unknown) => (typeof iso === "string" && iso ? toDateKey(new Date(iso)) : null);

function variantToValues(v: ProductVariant & Record<string, unknown>): VariantValues {
  return {
    id: v.id, name: v.name, sku: text(v.sku), barcode: text(v.barcode),
    unitType: normalizeUnitType(v.unitType), unitValue: text(v.unitValue), mrp: text(v.mrp), packType: text(v.packType),
    discountType: text(v.discountType as string | null), discountValue: text(v.discountValue as string | null),
    discountStart: dateKey(v.discountStart), discountEnd: dateKey(v.discountEnd),
  };
}

export function productToForm(p: ProductDetail): ProductFormValues {
  return {
    ...emptyProductForm(),
    name: p.name, brandId: p.brand?.id ?? "", description: text(p.description),
    productType: text(p.productType), foodType: text(p.foodType), isActive: p.isActive,
    tags: p.tags ?? [], imageUrl: p.imageUrl, images: p.images ?? [],
    hsnCode: text(p.hsnCode), gstPercent: p.gstPercent == null ? "" : String(Number(p.gstPercent)),
    fssaiLicense: text(p.fssaiLicense), mfgLicenseNo: text(p.mfgLicenseNo),
    manufacturerName: text(p.manufacturerName), countryOfOrigin: text(p.countryOfOrigin),
    regulatoryMarks: p.regulatoryMarks ?? [], certifications: p.certifications ?? [],
    dangerWarnings: text(p.dangerWarnings), usageInstructions: text(p.usageInstructions),
    ingredients: text(p.ingredients), allergens: p.allergens ?? [], servingSize: text(p.servingSize),
    nutritionalInfo: p.nutritionalInfo == null ? "" : JSON.stringify(p.nutritionalInfo),
    shelfLifeDays: text(p.shelfLifeDays), storageType: text(p.storageType), storageInstructions: text(p.storageInstructions),
    taName: text(p.translations?.ta?.name), taDescription: text(p.translations?.ta?.description),
    variants: p.variants.map((v) => variantToValues(v as ProductVariant & Record<string, unknown>)),
  };
}
