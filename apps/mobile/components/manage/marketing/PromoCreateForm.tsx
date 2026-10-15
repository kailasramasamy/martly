import { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useManageScope } from "../../../lib/manage-scope-context";
import { useAuth } from "../../../lib/auth-context";

const PLACEHOLDER = 'e.g. "paneer 5% off", "ghee products", "fresh fruits"';

export function PromoCreateForm() {
  const router = useRouter();
  const isSuper = useAuth().user?.role === "SUPER_ADMIN";
  const { stores, organizationId } = useManageScope();
  const { run, running } = useAction();
  const [brief, setBrief] = useState("");
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [notify, setNotify] = useState(true);
  const [org, setOrg] = useState<string | null>(organizationId ?? null);
  const [error, setError] = useState<string | null>(null);
  const orgOptions = useMemo(
    () => [...new Map(stores.map((s) => [s.organizationId, s.organizationName])).entries()].map(([value, label]) => ({ value, label })),
    [stores],
  );

  const submit = async () => {
    if (brief.trim().length < 3) return setError("Enter at least 3 characters");
    if (isSuper && !org) return setError("Pick an organization");
    setError(null);
    const res = await run(() => api.post<{ id: string }>("/api/v1/promos", { brief: brief.trim(), autoLaunch, notify, ...(isSuper ? { organizationId: org } : {}) }));
    if (res) router.replace(`/manage/promos/${res.data.id}`);
  };

  return (
    <ManageStackScreen title="New promo" actions={<View style={styles.bar}><Button label="Create promo" icon="rocket-outline" onPress={submit} loading={running} style={styles.btn} /></View>}>
      <SectionCard title="Brief">
        {isSuper ? <SelectField label="Organization" required value={org} options={orgOptions} onChange={setOrg} /> : null}
        <TextField label="What do you want to promote?" required value={brief} onChangeText={setBrief} multiline maxLength={200} placeholder={PLACEHOLDER} error={error} hint="The AI drafts the banner, copy and discount, usually in about a minute" />
      </SectionCard>
      <SectionCard title="Options">
        <SwitchRow label="Launch automatically" description="Skips the review step" value={autoLaunch} onValueChange={setAutoLaunch} />
        <SwitchRow label="Notify customers" description="One push per day at most" value={notify} onValueChange={setNotify} />
      </SectionCard>
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1 },
  btn: { flex: 1 },
});
