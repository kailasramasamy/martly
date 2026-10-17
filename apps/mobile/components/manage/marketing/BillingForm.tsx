import { useState } from "react";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { INDIAN_STATES } from "@martly/shared/constants";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { Button } from "../ui/Button";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { useAuth } from "../../../lib/auth-context";
import type { BillingProfile } from "./plan-types";

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

interface FormState {
  billingName: string;
  gstin: string;
  billingAddress: string;
  billingState: string | null;
}

type Errors = Partial<Record<keyof FormState, string>>;

function validate(f: FormState): Errors {
  const errors: Errors = {};
  if (!f.billingName.trim()) errors.billingName = "Enter the name for invoices";
  if (f.gstin && !GSTIN.test(f.gstin)) errors.gstin = "Enter a valid 15-character GSTIN";
  if (!f.billingAddress.trim()) errors.billingAddress = "Enter the billing address";
  if (!f.billingState) errors.billingState = "Choose a state";
  return errors;
}

export function BillingForm() {
  const { data, loading, error, reload } = useResource<BillingProfile>("/api/v1/marketing/billing-profile");
  if (!data) return <ManageStackScreen title="Billing details" loading={loading} error={error} onRetry={reload}>{null}</ManageStackScreen>;
  return <Fields profile={data} />;
}

function Fields({ profile }: { profile: BillingProfile }) {
  const router = useRouter();
  const { user } = useAuth();
  const { run, running } = useAction();
  const canSave = can(user, "marketing-plan", "edit");
  const [f, setF] = useState<FormState>({
    billingName: profile.billingName ?? profile.name, gstin: profile.gstin ?? "",
    billingAddress: profile.billingAddress ?? "", billingState: profile.billingState,
  });
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { billingName: f.billingName.trim(), gstin: f.gstin || undefined, billingAddress: f.billingAddress.trim(), billingState: f.billingState };
    if (await run(() => api.put("/api/v1/marketing/billing-profile", body), "Billing details saved")) router.back();
  };

  const actions = canSave
    ? <Button label="Save details" onPress={save} loading={running} style={{ flex: 1 }} />
    : <Button label="Only the owner can edit" onPress={save} disabled style={{ flex: 1 }} />;
  return (
    <ManageStackScreen title="Billing details" actions={actions}>
      <SectionCard title="Shown on invoices">
        <TextField label="Billing name" required value={f.billingName} onChangeText={set("billingName")} editable={canSave} error={errors.billingName} />
        <TextField label="GSTIN" value={f.gstin} onChangeText={(t) => set("gstin")(t.toUpperCase())} autoCapitalize="characters" maxLength={15} editable={canSave} hint="Optional. Add it to claim GST input credit" error={errors.gstin} />
        <TextField label="Billing address" required value={f.billingAddress} onChangeText={set("billingAddress")} multiline editable={canSave} error={errors.billingAddress} />
        <SelectField label="State" required value={f.billingState} options={STATE_OPTIONS} onChange={set("billingState")} disabled={!canSave} error={errors.billingState} hint="Decides whether CGST + SGST or IGST applies" />
      </SectionCard>
    </ManageStackScreen>
  );
}
