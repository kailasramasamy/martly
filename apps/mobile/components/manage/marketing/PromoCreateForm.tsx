import { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { Button } from "../ui/Button";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useManageScope } from "../../../lib/manage-scope-context";
import { useAuth } from "../../../lib/auth-context";
import { PromoImageChoice, PromoOptions, type ImageMode } from "./PromoCreateParts";
import { PromoRequestForm } from "./PromoRequestForm";
import { PlanLimitNotice, usePlanLimit } from "./PlanLimit";

const PLACEHOLDER = 'e.g. "paneer 5% off", "ghee products", "fresh fruits"';

/** Super admin's form, with the banner, launch and notification choices; store owners just say what to promote */
export function PromoCreateForm() {
  return useAuth().user?.role === "SUPER_ADMIN" ? <SuperAdminPromoForm /> : <PromoRequestForm />;
}

function SuperAdminPromoForm() {
  const router = useRouter();
  const { stores, organizationId } = useManageScope();
  const { run, running } = useAction();
  const limit = usePlanLimit();
  const [brief, setBrief] = useState("");
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [notify, setNotify] = useState(true);
  const [mode, setMode] = useState<ImageMode>("ai");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [org, setOrg] = useState<string | null>(organizationId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | undefined>();
  const orgOptions = useMemo(
    () => [...new Map(stores.map((s) => [s.organizationId, s.organizationName])).entries()].map(([value, label]) => ({ value, label })),
    [stores],
  );

  const submit = async () => {
    if (brief.trim().length < 3) return setError("Enter at least 3 characters");
    if (!org) return setError("Pick an organization");
    if (mode === "upload" && !imageUrl) return setImageError("Upload a banner image");
    setError(null);
    setImageError(undefined);
    const body = {
      brief: brief.trim(), autoLaunch, notify, organizationId: org, ...(mode === "upload" ? { imageUrl } : {}),
    };
    const res = await run(() => limit.capture(() => api.post<{ id: string }>("/api/v1/promos", body)));
    if (res) router.replace(`/manage/promos/${res.data.id}`);
  };

  const create = <Button label="Create promo" icon="rocket-outline" onPress={submit} loading={running} style={styles.btn} />;
  return (
    <ManageStackScreen title="New promotion" actions={<View style={styles.bar}>{create}</View>}>
      <SectionCard title="Brief">
        <SelectField label="Organization" required value={org} options={orgOptions} onChange={setOrg} />
        <TextField label="What do you want to promote?" required value={brief} onChangeText={setBrief} multiline maxLength={200} placeholder={PLACEHOLDER} error={error} hint="Martly drafts the banner, copy and discount, usually in about a minute" />
      </SectionCard>
      <PromoImageChoice mode={mode} onMode={setMode} imageUrl={imageUrl} onImage={setImageUrl} error={imageError} />
      <PromoOptions autoLaunch={autoLaunch} onAutoLaunch={setAutoLaunch} notify={notify} onNotify={setNotify} />
      <PlanLimitNotice message={limit.message} />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1 },
  btn: { flex: 1 },
});
