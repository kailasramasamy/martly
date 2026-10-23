import { useState } from "react";
import { BottomSheet } from "../../../search/BottomSheet";
import { TextField } from "../../ui/TextField";
import { SwitchRow } from "../../ui/SwitchRow";
import { Button } from "../../ui/Button";
import { NumberField } from "./NumberField";
import { specFor, validatePackage, type NumSpec, type PackageErrors } from "./package-specs";
import type { AdProduct } from "./types";

interface Props {
  visible: boolean;
  product: AdProduct;
  saving: boolean;
  onSave: (product: AdProduct) => void;
  onClose: () => void;
}

/** Empty reads as null for optional amounts and NaN (fails validation) for required ones */
const emptyValue = (n: NumSpec) => (n.nullable ? null : Number.NaN);

export function PackageEditSheet({ visible, product, saving, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(product);
  const [errors, setErrors] = useState<PackageErrors>({});
  const spec = specFor(product.kind);
  const set = (change: Partial<AdProduct>) => setDraft((prev) => ({ ...prev, ...change }));

  const submit = () => {
    const found = validatePackage(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) onSave({ ...draft, name: draft.name.trim(), description: draft.description?.trim() || null });
  };

  return (
    <BottomSheet visible={visible} title={product.name} onClose={onClose} scrollable footer={<Button label="Save" onPress={submit} loading={saving} />}>
      {spec.named ? (
        <>
          <TextField label="Name" required value={draft.name} onChangeText={(name) => set({ name })} maxLength={60} error={errors.name} />
          <TextField label="Description" value={draft.description ?? ""} onChangeText={(v) => set({ description: v })} multiline maxLength={240} error={errors.description} />
        </>
      ) : null}
      {spec.numbers.map((n) => (
        <NumberField
          key={n.key}
          label={n.label}
          prefix={n.money ? "₹" : undefined}
          placeholder={n.nullable ? "None" : undefined}
          integer={!n.money}
          value={Number.isNaN(draft[n.key]) ? null : draft[n.key]}
          onChange={(v) => set({ [n.key]: v ?? emptyValue(n) })}
          error={errors[n.key]}
        />
      ))}
      {spec.push ? <SwitchRow label="Push included" value={draft.pushIncluded} onValueChange={(pushIncluded) => set({ pushIncluded })} /> : null}
      <SwitchRow label="On sale" value={draft.isActive} onValueChange={(isActive) => set({ isActive })} />
    </BottomSheet>
  );
}
