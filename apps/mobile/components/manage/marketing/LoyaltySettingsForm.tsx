import { useState } from "react";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { toQuery } from "../../../lib/manage/query";
import { useManageScope } from "../../../lib/manage-scope-context";
import { numberText, parseNumber } from "./common";
import type { LoyaltyConfig } from "./loyalty-types";

interface FormState {
  isEnabled: boolean;
  earnRate: string;
  reviewRewardPoints: string;
  minRedeemPoints: string;
  maxRedeemPercentage: string;
}

const DEFAULTS: FormState = { isEnabled: true, earnRate: "1", reviewRewardPoints: "0", minRedeemPoints: "10", maxRedeemPercentage: "50" };

const fromConfig = (c: LoyaltyConfig | null): FormState => c ? {
  isEnabled: c.isEnabled, earnRate: numberText(c.earnRate), reviewRewardPoints: numberText(c.reviewRewardPoints),
  minRedeemPoints: numberText(c.minRedeemPoints), maxRedeemPercentage: numberText(c.maxRedeemPercentage),
} : DEFAULTS;

function whole(text: string, min: number, max: number): number | null {
  const n = parseNumber(text);
  return n !== null && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (whole(f.earnRate, 0, 100) === null) errors.earnRate = "Whole number from 0 to 100";
  if (whole(f.reviewRewardPoints, 0, 1000) === null) errors.reviewRewardPoints = "Whole number from 0 to 1000";
  if (whole(f.minRedeemPoints, 0, 1_000_000) === null) errors.minRedeemPoints = "Whole number, 0 or more";
  if (whole(f.maxRedeemPercentage, 1, 100) === null) errors.maxRedeemPercentage = "Whole number from 1 to 100";
  return errors;
}

export function LoyaltySettingsForm({ onCustomers }: { onCustomers: () => void }) {
  const { organizationId } = useManageScope();
  const path = organizationId ? `/api/v1/loyalty/config${toQuery({ organizationId })}` : null;
  const { data, loading, error, reload } = useResource<LoyaltyConfig | null>(path);

  if (!organizationId) {
    return <ManageStackScreen title="Loyalty"><EmptyState icon="storefront-outline" title="Pick a store" message="Choose a store from the switcher on a tab to edit its organization's loyalty program." /></ManageStackScreen>;
  }
  if (loading || error) return <ManageStackScreen title="Loyalty" loading={loading} error={error} onRetry={reload}>{null}</ManageStackScreen>;
  return <Fields key={data?.id ?? "new"} initial={fromConfig(data)} existing={!!data} organizationId={organizationId} onCustomers={onCustomers} />;
}

interface FieldsProps {
  initial: FormState;
  existing: boolean;
  organizationId: string;
  onCustomers: () => void;
}

function Fields({ initial, existing, organizationId, onCustomers }: FieldsProps) {
  const { run, running } = useAction();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [saved, setSaved] = useState(existing);
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = {
      isEnabled: f.isEnabled, earnRate: Number(f.earnRate), reviewRewardPoints: Number(f.reviewRewardPoints),
      minRedeemPoints: Number(f.minRedeemPoints), maxRedeemPercentage: Number(f.maxRedeemPercentage),
    };
    if (await run(() => api.put(`/api/v1/loyalty/config${toQuery({ organizationId })}`, body), "Loyalty settings saved")) setSaved(true);
  };

  return (
    <ManageStackScreen title="Loyalty" actions={<Button label={saved ? "Save settings" : "Enable loyalty program"} onPress={save} loading={running} style={{ flex: 1 }} />}>
      <SectionCard title="Program"><SwitchRow label="Enable loyalty program" value={f.isEnabled} onValueChange={set("isEnabled")} /></SectionCard>
      <SectionCard title="Earning">
        <TextField label="Points per ₹100 spent" required value={f.earnRate} onChangeText={set("earnRate")} keyboardType="number-pad" hint="Credited when an order is delivered" error={errors.earnRate} />
        <TextField label="Review reward points" value={f.reviewRewardPoints} onChangeText={set("reviewRewardPoints")} keyboardType="number-pad" hint="Awarded when a verified review is approved (0 = off)" error={errors.reviewRewardPoints} />
      </SectionCard>
      <SectionCard title="Redemption">
        <TextField label="Minimum points to redeem" required value={f.minRedeemPoints} onChangeText={set("minRedeemPoints")} keyboardType="number-pad" error={errors.minRedeemPoints} />
        <TextField label="Max share of order payable with points" required value={f.maxRedeemPercentage} onChangeText={set("maxRedeemPercentage")} keyboardType="number-pad" suffix="%" hint="1 point = ₹1 off at checkout" error={errors.maxRedeemPercentage} />
      </SectionCard>
      <SectionCard title="Customers"><Button label="View customer balances" variant="secondary" icon="people-outline" onPress={onCustomers} /></SectionCard>
    </ManageStackScreen>
  );
}
