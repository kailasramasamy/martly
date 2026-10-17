import { useState } from "react";
import { StyleSheet } from "react-native";
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
import { ACTION_OPTIONS, BannerTargetField } from "./BannerTargetField";
import { BannersSection, DiscountSection, ScheduleSection } from "./ManualPromoParts";
import { PlanLimitNotice, usePlanLimit } from "./PlanLimit";
import { useEntitlements } from "./use-entitlements";
import { emptyDraft } from "./banner-draft";
import { isDiscountable, manualPayload, validateManual, type ManualPromoErrors, type ManualPromoState } from "./manual-promo";

const initialState = (): ManualPromoState => ({
  title: "", subtitle: "", actionType: "CATEGORY", actionTarget: "", discountType: null, discountValue: "", durationDays: "7",
  start: "now", launchDate: null, notify: false, banners: [emptyDraft()],
});

/** Owner-built promotion: pick the target and optional discount, add copy and banners */
export function ManualPromoForm() {
  const router = useRouter();
  const isSuper = useAuth().user?.role === "SUPER_ADMIN";
  const { organizationId } = useManageScope();
  const { data: entitlements } = useEntitlements();
  const { run, running } = useAction();
  const limit = usePlanLimit();
  const [state, setState] = useState(initialState);
  const [errors, setErrors] = useState<ManualPromoErrors>({ banners: {} });
  const pushAllowed = isSuper || !!entitlements?.pushIncluded;
  const patch = (p: Partial<ManualPromoState>) => setState((prev) => ({ ...prev, ...p }));

  const changeAction = (actionType: string) => patch({ actionType, actionTarget: "", ...(isDiscountable(actionType) ? {} : { discountType: null, discountValue: "" }) });

  const submit = async () => {
    const check = validateManual(state);
    setErrors(check.errors);
    if (!check.ok) return;
    const body = manualPayload(state, pushAllowed, organizationId);
    const res = await run(() => limit.capture(() => api.post<{ id: string }>("/api/v1/promos/manual", body)));
    if (res) router.replace(`/manage/promos/${res.data.id}`);
  };

  return (
    <ManageStackScreen title="Manual promotion" actions={<Button label="Create promotion" icon="rocket-outline" onPress={submit} loading={running} style={styles.btn} />}>
      <SectionCard title="Promotion">
        <TextField label="Title" required value={state.title} onChangeText={(title) => patch({ title })} maxLength={60} error={errors.title} />
        <TextField label="Subtitle" value={state.subtitle} onChangeText={(subtitle) => patch({ subtitle })} maxLength={90} />
        <SelectField label="Opens / covers" value={state.actionType} options={ACTION_OPTIONS} onChange={changeAction} />
        <BannerTargetField actionType={state.actionType} value={state.actionTarget} onChange={(actionTarget) => patch({ actionTarget })} error={errors.actionTarget} />
      </SectionCard>
      <DiscountSection state={state} errors={errors} onChange={patch} />
      <ScheduleSection state={state} errors={errors} onChange={patch} pushAllowed={pushAllowed} />
      <BannersSection state={state} errors={errors} onChange={patch} entitlements={entitlements} />
      <PlanLimitNotice message={limit.message} />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  btn: { flex: 1 },
});
