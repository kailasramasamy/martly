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
import { NoPromotionsLeft, PromoImageChoice, PromoOptions, type ImageMode } from "./PromoCreateParts";
import { PlanLimitNotice, usePlanLimit } from "./PlanLimit";
import { promotionsLeft, useEntitlements } from "./use-entitlements";

const PLACEHOLDER = 'e.g. "paneer 5% off", "ghee products", "fresh fruits"';

export function PromoCreateForm() {
  const router = useRouter();
  const isSuper = useAuth().user?.role === "SUPER_ADMIN";
  const { stores, organizationId } = useManageScope();
  const { data: entitlements } = useEntitlements();
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
  const left = entitlements ? promotionsLeft(entitlements) : null;
  const outOfPromos = !isSuper && left === 0;
  const pushAllowed = isSuper || !!entitlements?.pushIncluded;

  const submit = async () => {
    if (brief.trim().length < 3) return setError("Enter at least 3 characters");
    if (isSuper && !org) return setError("Pick an organization");
    if (mode === "upload" && !imageUrl) return setImageError("Upload a banner image");
    setError(null);
    setImageError(undefined);
    const body = {
      brief: brief.trim(), autoLaunch, notify: pushAllowed && notify, ...(mode === "upload" ? { imageUrl } : {}), ...(isSuper ? { organizationId: org } : {}),
    };
    const res = await run(() => limit.capture(() => api.post<{ id: string }>("/api/v1/promos", body)));
    if (res) router.replace(`/manage/promos/${res.data.id}`);
  };

  const create = <Button label="Create promo" icon="rocket-outline" onPress={submit} loading={running} disabled={outOfPromos} style={styles.btn} />;
  return (
    <ManageStackScreen title="New promo" actions={<View style={styles.bar}>{create}</View>}>
      {outOfPromos ? <NoPromotionsLeft /> : null}
      <SectionCard title={left === null ? "Brief" : `Brief · ${left} promotion${left === 1 ? "" : "s"} left`}>
        {isSuper ? <SelectField label="Organization" required value={org} options={orgOptions} onChange={setOrg} /> : null}
        <TextField label="What do you want to promote?" required value={brief} onChangeText={setBrief} multiline maxLength={200} placeholder={PLACEHOLDER} error={error} hint="The AI drafts the banner, copy and discount, usually in about a minute" />
      </SectionCard>
      <PromoImageChoice mode={mode} onMode={setMode} imageUrl={imageUrl} onImage={setImageUrl} error={imageError} />
      <PromoOptions autoLaunch={autoLaunch} onAutoLaunch={setAutoLaunch} notify={notify} onNotify={setNotify} pushAllowed={pushAllowed} />
      <PlanLimitNotice message={limit.message} />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1 },
  btn: { flex: 1 },
});
