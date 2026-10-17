import { useState } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { PromoDetail } from "@martly/shared/types";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { Button } from "../ui/Button";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { BannerDraftFields, type PromoContext } from "./BannerDraftFields";
import { PlanLimitNotice, usePlanLimit } from "./PlanLimit";
import { useEntitlements } from "./use-entitlements";
import { draftFromBanner, draftPayload, emptyDraft, hasErrors, validateDraft, type BannerDraft, type DraftErrors } from "./banner-draft";

interface Props {
  promoId: string;
  bannerId?: string;
}

/** Adds a banner to a promotion, or edits one of its banners */
export function PromoBannerForm({ promoId, bannerId }: Props) {
  const { data: promo, loading, error, reload } = useResource<PromoDetail>(`/api/v1/promos/${promoId}`);
  const title = bannerId ? "Edit banner" : "Add banner";
  const existing = promo?.banners.find((b) => b.id === bannerId);
  if (!promo || (bannerId && !existing)) {
    return <ManageStackScreen title={title} loading={loading} error={error ?? (promo ? "Banner not found" : null)} onRetry={reload}>{null}</ManageStackScreen>;
  }
  return <BannerEditor key={bannerId ?? "new"} promo={promo} bannerId={bannerId} initial={existing ? draftFromBanner(existing) : emptyDraft()} title={title} />;
}

interface EditorProps {
  promo: PromoDetail;
  bannerId?: string;
  initial: BannerDraft;
  title: string;
}

function BannerEditor({ promo, bannerId, initial, title }: EditorProps) {
  const router = useRouter();
  const { data: entitlements } = useEntitlements();
  const { run, running } = useAction();
  const limit = usePlanLimit();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const context: PromoContext = { title: promo.title ?? "", subtitle: "", actionType: promo.actionType ?? "NONE", actionTarget: promo.actionTarget ?? "" };

  const save = async () => {
    const found = validateDraft(draft);
    setErrors(found);
    if (hasErrors(found)) return;
    const base = `/api/v1/promos/${promo.id}/banners`;
    const body = draftPayload(draft, !!bannerId);
    const res = await run(() => limit.capture(() => (bannerId ? api.put<PromoDetail>(`${base}/${bannerId}`, body) : api.post<PromoDetail>(base, body))), bannerId ? "Banner updated" : "Banner added");
    if (res) router.back();
  };

  return (
    <ManageStackScreen title={title} actions={<Button label={bannerId ? "Save changes" : "Add banner"} onPress={save} loading={running} style={styles.btn} />}>
      <SectionCard title="Banner">
        <BannerDraftFields draft={draft} promo={context} errors={errors} entitlements={entitlements} onChange={(p) => setDraft((prev) => ({ ...prev, ...p }))} />
      </SectionCard>
      <PlanLimitNotice message={limit.message} />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  btn: { flex: 1 },
});
