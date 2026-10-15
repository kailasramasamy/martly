import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import type { SectionProps } from "./sections";

export function TranslationsSection({ values, onChange }: SectionProps) {
  return (
    <SectionCard title="Tamil translation">
      <TextField label="Name (Tamil)" value={values.taName} onChangeText={(taName) => onChange({ taName })} />
      <TextField label="Description (Tamil)" multiline value={values.taDescription} onChangeText={(taDescription) => onChange({ taDescription })} />
    </SectionCard>
  );
}
