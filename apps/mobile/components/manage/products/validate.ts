import type { ProductFormValues } from "./form";

export interface ProductFormErrors {
  name?: string;
  nutritionalInfo?: string;
  variants: Record<number, string>;
}

const isPositive = (v: string) => v !== "" && Number(v) > 0;

export function validateProductForm(values: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = { variants: {} };
  if (!values.name.trim()) errors.name = "Name is required";
  if (values.nutritionalInfo.trim()) {
    try {
      JSON.parse(values.nutritionalInfo);
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
      errors.nutritionalInfo = "Must be valid JSON, e.g. {\"energy\":\"250kcal\"}";
    }
  }
  values.variants.forEach((v, i) => {
    if (!v.name.trim()) errors.variants[i] = "Variant name is required";
    else if (!isPositive(v.unitValue)) errors.variants[i] = "Unit value must be greater than 0";
    else if (v.mrp !== "" && !isPositive(v.mrp)) errors.variants[i] = "MRP must be greater than 0";
  });
  return errors;
}

export function hasErrors(errors: ProductFormErrors): boolean {
  return !!errors.name || !!errors.nutritionalInfo || Object.keys(errors.variants).length > 0;
}
