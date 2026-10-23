import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useResource } from "../../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../ManageStackScreen";
import { SectionCard } from "../../ui/SectionCard";
import { TextField } from "../../ui/TextField";
import { SelectField } from "../../ui/SelectField";
import { Button } from "../../ui/Button";

interface FormState { brandId: string; name: string; email: string; password: string; phone: string }

const EMPTY: FormState = { brandId: "", name: "", email: "", password: "", phone: "" };

type Errors = Partial<Record<keyof FormState, string>>;

function validate(f: FormState): Errors {
  const errors: Errors = {};
  if (!f.brandId) errors.brandId = "Choose a brand";
  if (f.name.trim().length < 2) errors.name = "Enter at least 2 characters";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errors.email = "Enter a valid email";
  if (f.password.length < 8) errors.password = "Use at least 8 characters";
  return errors;
}

export function PartnerForm() {
  const router = useRouter();
  const brands = useResource<{ id: string; name: string }[]>("/api/v1/brands?pageSize=1000");
  const { run, running } = useAction();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const options = useMemo(() => (brands.data ?? []).map((b) => ({ value: b.id, label: b.name })), [brands.data]);
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { brandId: f.brandId, name: f.name.trim(), email: f.email.trim(), password: f.password, phone: f.phone.trim() || undefined };
    if (await run(() => api.post("/api/v1/brand-campaigns/partners", body), "Brand login created")) router.back();
  };

  return (
    <ManageStackScreen
      title="New brand login"
      loading={brands.loading}
      error={brands.error}
      onRetry={brands.reload}
      actions={<Button label="Create login" onPress={save} loading={running} style={{ flex: 1 }} />}
    >
      <SectionCard title="Brand login">
        <SelectField label="Brand" required value={f.brandId || null} options={options} onChange={set("brandId")} placeholder="Choose a brand" error={errors.brandId} />
        <TextField label="Name" required value={f.name} onChangeText={set("name")} maxLength={80} autoCapitalize="words" error={errors.name} />
        <TextField label="Email" required value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
        <TextField label="Password" required value={f.password} onChangeText={set("password")} secureTextEntry autoCapitalize="none" maxLength={100} hint="At least 8 characters" error={errors.password} />
        <TextField label="Phone" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" maxLength={15} placeholder="Optional" />
      </SectionCard>
    </ManageStackScreen>
  );
}
