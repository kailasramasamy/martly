import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { KpiTile } from "../ui/KpiTile";
import { EmptyState } from "../ui/EmptyState";
import { formatINR } from "../ui/tokens";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { toQuery } from "../../../lib/manage/query";
import { useManageScope } from "../../../lib/manage-scope-context";
import { numberText, parseNumber } from "./common";
import type { ReferralConfig, ReferralStats } from "./loyalty-types";

interface FormState {
  isEnabled: boolean;
  referrerReward: string;
  refereeReward: string;
  maxReferralsPerUser: string;
}

const DEFAULTS: FormState = { isEnabled: true, referrerReward: "50", refereeReward: "25", maxReferralsPerUser: "50" };

const fromConfig = (c: ReferralConfig | null): FormState => c ? {
  isEnabled: c.isEnabled, referrerReward: numberText(Number(c.referrerReward)), refereeReward: numberText(Number(c.refereeReward)),
  maxReferralsPerUser: numberText(c.maxReferralsPerUser),
} : DEFAULTS;

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  const reward = (text: string) => { const n = parseNumber(text); return n !== null && n >= 0 && n <= 10000; };
  if (!reward(f.referrerReward)) errors.referrerReward = "Between 0 and 10,000";
  if (!reward(f.refereeReward)) errors.refereeReward = "Between 0 and 10,000";
  const max = parseNumber(f.maxReferralsPerUser);
  if (max === null || !Number.isInteger(max) || max < 1 || max > 1000) errors.maxReferralsPerUser = "Whole number from 1 to 1000";
  return errors;
}

export function ReferralSettingsForm({ onList }: { onList: () => void }) {
  const { organizationId } = useManageScope();
  const query = toQuery({ organizationId });
  const config = useResource<ReferralConfig | null>(organizationId ? `/api/v1/referrals/config${query}` : null);
  const stats = useResource<ReferralStats>(`/api/v1/referrals/stats${query}`);

  if (!organizationId) {
    return <ManageStackScreen title="Referrals"><EmptyState icon="storefront-outline" title="Pick a store" message="Choose a store from the switcher on a tab to edit its organization's referral program." /></ManageStackScreen>;
  }
  if (config.loading || config.error) return <ManageStackScreen title="Referrals" loading={config.loading} error={config.error} onRetry={config.reload}>{null}</ManageStackScreen>;
  return <Fields key={config.data?.id ?? "new"} initial={fromConfig(config.data)} existing={!!config.data} query={query} stats={stats.data} onList={onList} />;
}

interface FieldsProps {
  initial: FormState;
  existing: boolean;
  query: string;
  stats: ReferralStats | null;
  onList: () => void;
}

function Fields({ initial, existing, query, stats, onList }: FieldsProps) {
  const { run, running } = useAction();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [saved, setSaved] = useState(existing);
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { isEnabled: f.isEnabled, referrerReward: Number(f.referrerReward), refereeReward: Number(f.refereeReward), maxReferralsPerUser: Number(f.maxReferralsPerUser) };
    if (await run(() => api.put(`/api/v1/referrals/config${query}`, body), "Referral settings saved")) setSaved(true);
  };

  return (
    <ManageStackScreen title="Referrals" actions={<Button label={saved ? "Save settings" : "Enable referral program"} onPress={save} loading={running} style={styles.flex} />}>
      {stats ? (
        <View style={styles.row}>
          <KpiTile label="Referrals" value={String(stats.totalReferrals)} />
          <KpiTile label="Converted" value={`${stats.conversionRate}%`} />
          <KpiTile label="Rewards given" value={formatINR(stats.totalRewardsGiven)} />
        </View>
      ) : null}
      <SectionCard title="Program"><SwitchRow label="Enable referral program" value={f.isEnabled} onValueChange={set("isEnabled")} /></SectionCard>
      <SectionCard title="Rewards">
        <TextField label="Referrer reward" required value={f.referrerReward} onChangeText={set("referrerReward")} keyboardType="decimal-pad" prefix={"₹"} hint="Wallet credit for the customer who shares their code" error={errors.referrerReward} />
        <TextField label="Referee reward" required value={f.refereeReward} onChangeText={set("refereeReward")} keyboardType="decimal-pad" prefix={"₹"} hint="Wallet credit for the new customer" error={errors.refereeReward} />
        <TextField label="Max referrals per user" required value={f.maxReferralsPerUser} onChangeText={set("maxReferralsPerUser")} keyboardType="number-pad" error={errors.maxReferralsPerUser} />
      </SectionCard>
      <SectionCard title="Referrals"><Button label="View all referrals" variant="secondary" icon="people-outline" onPress={onList} /></SectionCard>
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
