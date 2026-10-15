import { SectionCard } from "../ui/SectionCard";
import { Button } from "../ui/Button";
import { newVariant, type VariantValues } from "./form";
import { VariantEditor } from "./VariantEditor";
import type { SectionProps } from "./sections";

interface VariantsSectionProps extends SectionProps {
  mode: "create" | "edit";
}

/** Saved variants stay (store listings and orders reference them); only variants added in this session can be removed */
export function VariantsSection({ values, onChange, errors, mode }: VariantsSectionProps) {
  const patchVariant = (index: number, patch: Partial<VariantValues>) =>
    onChange({ variants: values.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)) });
  const removeVariant = (index: number) => onChange({ variants: values.variants.filter((_, i) => i !== index) });

  return (
    <SectionCard title="Variants & pricing">
      {values.variants.map((variant, index) => (
        <VariantEditor
          key={variant.id ?? `new-${index}`}
          index={index}
          value={variant}
          error={errors.variants[index]}
          showDiscount={mode === "edit"}
          onChange={(patch) => patchVariant(index, patch)}
          onRemove={!variant.id && values.variants.length > 1 ? () => removeVariant(index) : undefined}
        />
      ))}
      <Button label="Add variant" icon="add" variant="secondary" onPress={() => onChange({ variants: [...values.variants, newVariant()] })} />
    </SectionCard>
  );
}
