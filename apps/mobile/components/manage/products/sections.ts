import type { ProductFormErrors } from "./validate";
import type { ProductFormValues } from "./form";

export interface SectionProps {
  values: ProductFormValues;
  onChange: (patch: Partial<ProductFormValues>) => void;
  errors: ProductFormErrors;
}
