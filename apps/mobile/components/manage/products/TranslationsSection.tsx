import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import type { SectionProps } from "./sections";

/** New products get their blank Tamil fields filled by Martly after saving */
export function TranslationsSection({ values, onChange, isNew }: SectionProps & { isNew: boolean }) {
  const hint = isNew ? "Leave blank and Martly will translate it" : undefined;
  return (
    <SectionCard title="Tamil translation">
      <TextField label="Name (Tamil)" hint={hint} value={values.taName} onChangeText={(taName) => onChange({ taName })} />
      <TextField label="Description (Tamil)" hint={hint} multiline value={values.taDescription} onChangeText={(taDescription) => onChange({ taDescription })} />
    </SectionCard>
  );
}
