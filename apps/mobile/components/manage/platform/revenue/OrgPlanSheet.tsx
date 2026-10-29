import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useToast } from "../../../../lib/toast-context";
import { colors, fonts } from "../../../../constants/theme";
import { BottomSheet } from "../../../search/BottomSheet";
import { Button } from "../../ui/Button";
import { SwitchRow } from "../../ui/SwitchRow";
import { TextField } from "../../ui/TextField";
import { formatDate } from "../../ui/dates";
import { ChipSelect } from "../../marketing/ChipSelect";
import type { Subscriber } from "./types";

type PlanCode = "GROWTH" | "PRO";
type Flag = "webStoreAlwaysOn" | "unlimitedListings";

const PLANS = [
  { value: "GROWTH", label: "Growth" },
  { value: "PRO", label: "Pro" },
];

interface OrgPlanSheetProps {
  org: Subscriber | null;
  onClose: () => void;
  onChanged: () => void;
}

export function OrgPlanSheet({ org, onClose, onChanged }: OrgPlanSheetProps) {
  const { run, running } = useAction();
  const toast = useToast();
  const [flags, setFlags] = useState({ webStoreAlwaysOn: false, unlimitedListings: false });
  const [plan, setPlan] = useState<PlanCode>("GROWTH");
  const [days, setDays] = useState("365");
  const count = Number(days);
  const error = !Number.isInteger(count) || count < 1 || count > 730 ? "Enter 1 to 730 days" : undefined;

  useEffect(() => {
    if (org) setFlags({ webStoreAlwaysOn: org.webStoreAlwaysOn, unlimitedListings: org.unlimitedListings });
  }, [org]);

  const toggle = async (flag: Flag, value: boolean) => {
    const done = await run(() => api.patch(`/api/v1/marketing-admin/organizations/${org?.id}`, { [flag]: value }), "Saved");
    if (!done) return;
    setFlags((f) => ({ ...f, [flag]: value }));
    onChanged();
  };

  const give = async () => {
    const res = await run(() => api.post<{ endsAt: string; plan: { name: string } }>(`/api/v1/marketing-admin/organizations/${org?.id}/plan`, { productCode: plan, days: count }));
    if (!res) return;
    toast.show(`${res.data.plan.name} given until ${formatDate(res.data.endsAt)}`, "success");
    onChanged();
    onClose();
  };

  return (
    <BottomSheet scrollable visible={!!org} title={org?.name ?? ""} onClose={onClose}>
      <View style={styles.body}>
        <SwitchRow label="Always on martlyshop.in" description="The store's web store stays on whatever plan it's on" value={flags.webStoreAlwaysOn} onValueChange={(v) => toggle("webStoreAlwaysOn", v)} disabled={running} />
        <SwitchRow label="Unlimited own products" description="List own or local products without using listings" value={flags.unlimitedListings} onValueChange={(v) => toggle("unlimitedListings", v)} disabled={running} />
        <Text style={styles.heading}>Give a plan</Text>
        <ChipSelect options={PLANS} value={[plan]} onChange={(v) => setPlan((v.find((x) => x !== plan) ?? plan) as PlanCode)} />
        <TextField label="Days" keyboardType="number-pad" value={days} onChangeText={setDays} error={error} hint="Starts now, no payment" maxLength={3} />
        <Button label="Give plan" onPress={give} loading={running} disabled={!!error} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingBottom: 8 },
  heading: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 8 },
});
