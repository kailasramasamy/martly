import { useState } from "react";
import { useRouter } from "expo-router";
import type { CreditCampaignRow } from "@martly/shared/types";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { OptionalDate } from "../marketing/common";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { useManageScope } from "../../../lib/manage-scope-context";
import { useAuth } from "../../../lib/auth-context";
import { EMPTY_CREDIT_FORM, creditFormFrom, creditPayload, validateCreditForm, type CreditFormState } from "./credit-form";

export function CreditCampaignForm({ id }: { id?: string }) {
  const { data, loading, error, reload } = useResource<CreditCampaignRow>(id ? `/api/v1/credits/campaigns/${id}` : null);
  if (id && !data) {
    return <ManageStackScreen title="Edit welcome credit" loading={loading} error={error} onRetry={reload}>{null}</ManageStackScreen>;
  }
  return <CreditFields key={data?.id} campaign={data} />;
}

function CreditFields({ campaign }: { campaign: CreditCampaignRow | null }) {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId } = useManageScope();
  const { run, running } = useAction();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [f, setF] = useState(campaign ? creditFormFrom(campaign) : EMPTY_CREDIT_FORM);
  // Only a super admin can fund a campaign for Martly; a new one defaults to Martly when no store is chosen
  const [fundedByMartly, setFundedByMartly] = useState(campaign ? campaign.storeId === null : isSuperAdmin && !storeId);
  const [errors, setErrors] = useState<ReturnType<typeof validateCreditForm>>({});
  const set = <K extends keyof CreditFormState>(key: K) => (value: CreditFormState[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const targetStore = campaign ? campaign.storeId : fundedByMartly ? null : storeId;
  const needsStore = !campaign && !fundedByMartly && !storeId;

  const save = async () => {
    const found = validateCreditForm(f, !isSuperAdmin);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = creditPayload(f, campaign?.translations);
    const call = campaign
      ? () => api.patch(`/api/v1/credits/campaigns/${campaign.id}`, body)
      : () => api.post("/api/v1/credits/campaigns", { ...body, storeId: targetStore });
    if (await run(call, campaign ? "Welcome credit updated" : "Welcome credit created")) router.back();
  };

  const actions = <Button label={campaign ? "Save changes" : "Create"} onPress={save} loading={running} disabled={needsStore} style={{ flex: 1 }} />;

  return (
    <ManageStackScreen title={campaign ? "Edit welcome credit" : "New welcome credit"} actions={actions}>
      <SectionCard title="Offer">
        {isSuperAdmin && !campaign && <SwitchRow label="Funded by Martly" description="Off: funded by the store chosen at the top" value={fundedByMartly} onValueChange={setFundedByMartly} />}
        {needsStore && <TextField label="Store" value="Choose a store at the top first" onChangeText={() => undefined} editable={false} />}
        <TextField label="Credit amount" required value={f.amount} onChangeText={set("amount")} keyboardType="decimal-pad" prefix="₹" error={errors.amount} />
        <TextField label="Minimum order" required value={f.minOrderAmount} onChangeText={set("minOrderAmount")} keyboardType="decimal-pad" prefix="₹" error={errors.minOrderAmount} />
        <TextField label="Valid for (days)" required value={f.validDays} onChangeText={set("validDays")} keyboardType="number-pad" error={errors.validDays} />
        <TextField label="Total budget" required value={f.budget} onChangeText={set("budget")} keyboardType="decimal-pad" prefix="₹" hint="Stops giving credit once this much is spent or reserved" error={errors.budget} />
        <SwitchRow label="Active" value={f.isActive} onValueChange={set("isActive")} />
        <OptionalDate label="Ends" value={f.endsAt} onChange={set("endsAt")} placeholder="No end date" error={errors.endsAt} />
      </SectionCard>
      <SectionCard title="Wording">
        <TextField label="Headline" value={f.headline} onChangeText={set("headline")} maxLength={60} placeholder="₹50 free on your first order" hint="Worded from the amount if empty" />
        <TextField label="Message" value={f.message} onChangeText={set("message")} maxLength={200} multiline />
      </SectionCard>
      <SectionCard title="Tamil wording">
        <TextField label="Tamil headline" value={f.taHeadline} onChangeText={set("taHeadline")} maxLength={60} />
        <TextField label="Tamil message" value={f.taMessage} onChangeText={set("taMessage")} maxLength={200} multiline />
      </SectionCard>
    </ManageStackScreen>
  );
}
