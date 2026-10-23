import { useCallback, useEffect, useState } from "react";
import { INDIAN_STATES } from "@martly/shared/constants";
import { BottomSheet } from "../../../search/BottomSheet";
import { TextField } from "../../ui/TextField";
import { SelectField } from "../../ui/SelectField";
import { Button } from "../../ui/Button";
import { api, ApiError } from "../../../../lib/api";

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

export interface PaymentDetails {
  reference: string;
  billingName: string;
  gstin?: string;
  billingAddress: string;
  billingState: string;
}

interface Props {
  visible: boolean;
  campaignId: string;
  brandName: string;
  running: boolean;
  onSubmit: (details: PaymentDetails) => void;
  onClose: () => void;
}

interface FormState { reference: string; billingName: string; gstin: string; billingAddress: string; billingState: string | null }
type Errors = Partial<Record<keyof FormState, string>>;
type LastBilling = { billingName: string; gstin: string | null; billingAddress: string | null; billingState: string | null };

// The brand's details from its last invoice fill the form, so a repeat brand needs only the bank reference
function useLastBilling(visible: boolean, campaignId: string, apply: (b: LastBilling) => void) {
  useEffect(() => {
    if (!visible) return;
    let current = true;
    api.get<LastBilling | null>(`/api/v1/brand-campaigns/${campaignId}/billing`)
      .then((res) => { if (current && res.data) apply(res.data); })
      .catch((err) => { if (!(err instanceof ApiError)) throw err; });
    return () => { current = false; };
  }, [visible, campaignId, apply]);
}

function validate(f: FormState): Errors {
  const errors: Errors = {};
  if (f.reference.trim().length < 3) errors.reference = "Enter the bank reference";
  if (!f.billingName.trim()) errors.billingName = "Enter the name for the invoice";
  if (f.gstin && !GSTIN.test(f.gstin)) errors.gstin = "Enter a valid 15-character GSTIN";
  if (!f.billingAddress.trim()) errors.billingAddress = "Enter the billing address";
  if (!f.billingState) errors.billingState = "Choose a state";
  return errors;
}

const fillFrom = (b: LastBilling) => (prev: FormState): FormState => ({
  ...prev, billingName: b.billingName, gstin: b.gstin ?? "", billingAddress: b.billingAddress ?? "", billingState: b.billingState,
});

export function MarkPaidSheet({ visible, campaignId, brandName, running, onSubmit, onClose }: Props) {
  const [f, setF] = useState<FormState>({ reference: "", billingName: brandName, gstin: "", billingAddress: "", billingState: null });
  useLastBilling(visible, campaignId, useCallback((b: LastBilling) => setF(fillFrom(b)), []));
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0 || !f.billingState) return;
    onSubmit({
      reference: f.reference.trim(),
      billingName: f.billingName.trim(),
      gstin: f.gstin || undefined,
      billingAddress: f.billingAddress.trim(),
      billingState: f.billingState,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      title="Record bank transfer"
      onClose={onClose}
      scrollable
      footer={<Button label="Mark as paid" onPress={submit} loading={running} />}
    >
      <TextField label="Bank reference" required value={f.reference} onChangeText={set("reference")} maxLength={120} error={errors.reference} />
      <TextField label="Legal name" required value={f.billingName} onChangeText={set("billingName")} maxLength={120} error={errors.billingName} />
      <TextField label="GSTIN" value={f.gstin} onChangeText={(t) => set("gstin")(t.toUpperCase())} autoCapitalize="characters" maxLength={15} hint="Optional" error={errors.gstin} />
      <TextField label="Address" required value={f.billingAddress} onChangeText={set("billingAddress")} multiline maxLength={300} error={errors.billingAddress} />
      <SelectField label="State" required value={f.billingState} options={STATE_OPTIONS} onChange={set("billingState")} error={errors.billingState} hint="Decides whether CGST + SGST or IGST applies" />
    </BottomSheet>
  );
}
