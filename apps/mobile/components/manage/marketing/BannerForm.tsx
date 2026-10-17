import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { BannerActionTypeLabels, BannerPlacementLabels } from "@martly/shared/constants";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { useManageScope } from "../../../lib/manage-scope-context";
import { DeleteButton, OptionalDate, endOfDayIso, isoToDateKey, startOfDayIso } from "./common";
import { RemotePicker } from "./RemotePicker";
import { ImageSource } from "./ImageSource";
import { PlanLimitNotice, usePlanLimit } from "./PlanLimit";
import { useEntitlements } from "./use-entitlements";
import { useTaxonomyOptions, type TaxonomyLevel } from "./taxonomy";
import type { Entitlements } from "./plan-types";
import type { Banner } from "./types";

const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const PLACEMENT_OPTIONS = toOptions(BannerPlacementLabels);
const ACTION_OPTIONS = toOptions(BannerActionTypeLabels);

interface FormState {
  title: string;
  subtitle: string;
  imageUrl: string | null;
  textInImage: boolean;
  placement: string | null;
  actionType: string;
  actionTarget: string;
  sortOrder: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  storeId: string;
  taxonomy: string | null;
}

const EMPTY: FormState = {
  title: "", subtitle: "", imageUrl: null, textInImage: false, placement: null, actionType: "NONE", actionTarget: "",
  sortOrder: "0", isActive: true, startsAt: null, endsAt: null, storeId: "", taxonomy: null,
};

function fromBanner(b: Banner): FormState {
  const level: TaxonomyLevel | null = b.subcategoryId ? "subcategoryId" : b.categoryId ? "categoryId" : b.departmentId ? "departmentId" : null;
  return {
    title: b.title, subtitle: b.subtitle ?? "", imageUrl: b.imageUrl, textInImage: b.textInImage, placement: b.placement,
    actionType: b.actionType, actionTarget: b.actionTarget ?? "", sortOrder: String(b.sortOrder), isActive: b.isActive,
    startsAt: isoToDateKey(b.startsAt), endsAt: isoToDateKey(b.endsAt), storeId: b.storeId ?? "",
    taxonomy: level ? `${level}:${b[level]}` : null,
  };
}

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!f.title.trim()) errors.title = "Enter a title";
  if (!f.imageUrl) errors.imageUrl = "Banner image is required";
  if (!f.placement) errors.placement = "Choose a placement";
  if (f.actionType !== "NONE" && !f.actionTarget.trim()) errors.actionTarget = "Choose a target";
  if (f.actionType === "URL" && !/^https?:\/\/\S+$/.test(f.actionTarget.trim())) errors.actionTarget = "Enter a full URL starting with https://";
  if (!/^\d+$/.test(f.sortOrder)) errors.sortOrder = "Whole number, 0 or more";
  if (f.startsAt && f.endsAt && f.endsAt < f.startsAt) errors.endsAt = "Must be on or after the start date";
  return errors;
}

function toPayload(f: FormState) {
  const tax = f.taxonomy && f.placement === "CATEGORY_TOP" ? f.taxonomy.split(":") : null;
  return {
    title: f.title.trim(),
    subtitle: f.subtitle.trim() || null,
    imageUrl: f.imageUrl,
    textInImage: f.textInImage,
    placement: f.placement,
    actionType: f.actionType,
    actionTarget: f.actionType === "NONE" ? null : f.actionTarget.trim(),
    sortOrder: Number(f.sortOrder),
    isActive: f.isActive,
    startsAt: f.startsAt ? startOfDayIso(f.startsAt) : null,
    endsAt: f.endsAt ? endOfDayIso(f.endsAt) : null,
    storeId: f.storeId || null,
    departmentId: tax?.[0] === "departmentId" ? tax[1] : null,
    categoryId: tax?.[0] === "categoryId" ? tax[1] : null,
    subcategoryId: tax?.[0] === "subcategoryId" ? tax[1] : null,
  };
}

function slotsText(e: Entitlements | null): string | undefined {
  if (!e) return undefined;
  const { used, total } = e.bannerSlots;
  return total === null ? `Banner slots: ${used} used, unlimited` : `Banner slots: ${used} of ${total} used`;
}

type Setter = <K extends keyof FormState>(k: K) => (v: FormState[K]) => void;

export function BannerForm({ id }: { id?: string }) {
  const { data, loading, error, reload } = useResource<Banner>(id ? `/api/v1/banners/${id}` : null);
  if (id && !data) {
    return <ManageStackScreen title="Edit banner" loading={loading} error={error} onRetry={reload}>{null}</ManageStackScreen>;
  }
  if (data?.promo) return <Redirect href={`/manage/promos/${data.promo.id}`} />;
  return <BannerFields key={data?.id} initial={data ? fromBanner(data) : EMPTY} id={id} />;
}

function TargetField({ f, set, error }: { f: FormState; set: Setter; error?: string }) {
  const taxonomy = useTaxonomyOptions();
  const target = f.actionTarget;
  const onTarget = set("actionTarget");
  if (f.actionType === "CATEGORY") {
    const options = taxonomy.options.map((o) => ({ value: o.id, label: o.label }));
    return <SelectField label="Target category" required value={target || null} options={options} onChange={onTarget} error={error} placeholder={taxonomy.loading ? "Loading..." : "Select"} />;
  }
  if (f.actionType === "PRODUCT") return <RemotePicker label="Target product" required path="/api/v1/products" value={target || null} onChange={onTarget} error={error} />;
  if (f.actionType === "COLLECTION") return <RemotePicker label="Target collection" required path="/api/v1/collections" value={target || null} onChange={onTarget} error={error} />;
  if (f.actionType === "SEARCH") return <TextField label="Search query" required value={target} onChangeText={onTarget} placeholder="e.g. organic fruits" error={error} />;
  if (f.actionType === "URL") return <TextField label="URL" required value={target} onChangeText={onTarget} autoCapitalize="none" keyboardType="url" placeholder="https://" error={error} />;
  return null;
}

function TargetingSection({ f, set, errors }: { f: FormState; set: Setter; errors: Partial<Record<keyof FormState, string>> }) {
  const { stores } = useManageScope();
  const taxonomy = useTaxonomyOptions();
  const storeOptions = [{ value: "", label: "All stores (org-wide)" }, ...stores.map((s) => ({ value: s.id, label: s.name }))];
  return (
    <SectionCard title="Targeting and schedule">
      <SelectField label="Store" value={f.storeId} options={storeOptions} onChange={set("storeId")} />
      {f.placement === "CATEGORY_TOP" ? (
        <SelectField label="Category (optional)" value={f.taxonomy} options={taxonomy.options} onChange={set("taxonomy")} placeholder="All categories (generic)" />
      ) : null}
      <OptionalDate label="Starts" value={f.startsAt} onChange={set("startsAt")} placeholder="Immediately" />
      <OptionalDate label="Ends" value={f.endsAt} onChange={set("endsAt")} placeholder="No end date" minDate={f.startsAt ?? undefined} error={errors.endsAt} />
    </SectionCard>
  );
}

function BannerFields({ initial, id }: { initial: FormState; id?: string }) {
  const router = useRouter();
  const { organizationId } = useManageScope();
  const { run, running } = useAction();
  const limit = usePlanLimit();
  const { data: entitlements } = useEntitlements();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { ...toPayload(f), ...(id ? {} : { organizationId }) };
    const result = await run(() => limit.capture(() => (id ? api.put(`/api/v1/banners/${id}`, body) : api.post("/api/v1/banners", body))), id ? "Banner updated" : "Banner created");
    if (result) router.back();
  };
  const remove = async () => {
    if (await run(() => api.delete(`/api/v1/banners/${id}`), "Banner deleted")) router.back();
  };

  const actions = (
    <View style={styles.actions}>
      {id ? <DeleteButton title="Delete banner?" message={`"${f.title}" will be removed from the app.`} running={running} onConfirm={remove} /> : null}
      <Button label={id ? "Save changes" : "Create banner"} onPress={save} loading={running} style={styles.save} />
    </View>
  );

  return (
    <ManageStackScreen title={id ? "Edit banner" : "New banner"} actions={actions}>
      <SectionCard title="Image">
        <ImageSource
          imageUrl={f.imageUrl} onImage={set("imageUrl")} title={f.title} subtitle={f.subtitle} error={errors.imageUrl} entitlements={entitlements}
          onGenerated={(art) => setF((prev) => ({ ...prev, imageUrl: art.imageUrl, textInImage: art.textInImage }))}
        />
        <SwitchRow label="Title is part of the image" description="When on, the app adds no text over the artwork" value={f.textInImage} onValueChange={set("textInImage")} />
      </SectionCard>
      <SectionCard title="Details">
        <TextField label="Title" required value={f.title} onChangeText={set("title")} error={errors.title} />
        <TextField label="Subtitle" value={f.subtitle} onChangeText={set("subtitle")} />
        <SelectField label="Placement" required value={f.placement} options={PLACEMENT_OPTIONS} onChange={set("placement")} error={errors.placement} />
        <SelectField label="Action" value={f.actionType} options={ACTION_OPTIONS} onChange={(v) => setF((p) => ({ ...p, actionType: v, actionTarget: "" }))} />
        <TargetField f={f} set={set} error={errors.actionTarget} />
        <TextField label="Sort order" value={f.sortOrder} onChangeText={set("sortOrder")} keyboardType="number-pad" error={errors.sortOrder} />
        <SwitchRow label="Active" description={slotsText(entitlements)} value={f.isActive} onValueChange={set("isActive")} />
        <PlanLimitNotice message={limit.message} />
      </SectionCard>
      <TargetingSection f={f} set={set} errors={errors} />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flex: 1, flexDirection: "row", gap: 10 },
  save: { flex: 2 },
});
