export interface OnboardVariant {
  id: string;
  name: string;
  mrp: string | number | null;
}

export interface OnboardProduct {
  id: string;
  name: string;
  variants: OnboardVariant[];
}

export interface PickedVariant {
  variantId: string;
  productName: string;
  variantName: string;
  mrp: number | null;
  price: string;
  stock: string;
}

export type OnboardStep = "browse" | "pricing" | "review";
