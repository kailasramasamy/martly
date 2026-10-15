import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { FESTIVAL_REGIONS } from "@martly/shared/constants";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { DateField } from "../ui/DateField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { ChipSelect } from "./ChipSelect";
import { DeleteButton, endOfDayIso, isoToDateKey, parseNumber, startOfDayIso } from "./common";
import type { FestivalEvent } from "./types";

const KIND_OPTIONS = [
  { value: "OCCASION", label: "Occasion / Festival" },
  { value: "SEASON", label: "Season" },
];
const REGION_OPTIONS = Object.entries(FESTIVAL_REGIONS).map(([value, label]) => ({ value, label }));

interface FormState {
  name: string;
  slug: string;
  kind: string;
  startsAt: string | null;
  endsAt: string | null;
  leadDays: string;
  regions: string[];
  guidance: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  name: "", slug: "", kind: "OCCASION", startsAt: null, endsAt: null, leadDays: "7", regions: ["ALL"], guidance: "", isActive: true,
};

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const fromEvent = (e: FestivalEvent): FormState => ({
  name: e.name, slug: e.slug, kind: e.kind, startsAt: isoToDateKey(e.startsAt), endsAt: isoToDateKey(e.endsAt),
  leadDays: String(e.leadDays), regions: e.regions, guidance: e.guidance ?? "", isActive: e.isActive,
});

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!f.name.trim()) errors.name = "Enter a name";
  if (!/^[a-z0-9-]+$/.test(f.slug)) errors.slug = "Lowercase letters, numbers and hyphens only";
  if (!f.startsAt) errors.startsAt = "Pick a start date";
  if (!f.endsAt) errors.endsAt = "Pick an end date";
  else if (f.startsAt && f.endsAt < f.startsAt) errors.endsAt = "Must be on or after the start date";
  const lead = parseNumber(f.leadDays);
  if (lead === null || !Number.isInteger(lead) || lead < 0 || lead > 60) errors.leadDays = "Whole number from 0 to 60";
  if (f.regions.length === 0) errors.regions = "Pick at least one region";
  return errors;
}

export function FestivalForm({ id }: { id?: string }) {
  const { data, loading, error, reload } = useResource<FestivalEvent>(id ? `/api/v1/festival-events/${id}` : null);
  if (id && !data) {
    return <ManageStackScreen title="Edit festival" loading={loading} error={error} onRetry={reload}>{null}</ManageStackScreen>;
  }
  return <FestivalFields key={data?.id} initial={data ? fromEvent(data) : EMPTY} id={id} />;
}

function FestivalFields({ initial, id }: { initial: FormState; id?: string }) {
  const router = useRouter();
  const { run, running } = useAction();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const onName = (name: string) => setF((p) => ({ ...p, name, slug: id || p.slug !== slugify(p.name) ? p.slug : slugify(name) }));

  const save = async () => {
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = {
      name: f.name.trim(), slug: f.slug, kind: f.kind, leadDays: parseNumber(f.leadDays), regions: f.regions,
      guidance: f.guidance.trim() || null, isActive: f.isActive,
      startsAt: startOfDayIso(f.startsAt!), endsAt: endOfDayIso(f.endsAt!),
    };
    const result = await run(() => (id ? api.put(`/api/v1/festival-events/${id}`, body) : api.post("/api/v1/festival-events", body)), id ? "Festival updated" : "Festival created");
    if (result) router.back();
  };
  const remove = async () => {
    if (await run(() => api.delete(`/api/v1/festival-events/${id}`), "Festival deleted")) router.back();
  };

  const actions = (
    <View style={styles.actions}>
      {id ? <DeleteButton title="Delete festival?" message={`${f.name} and its calendar entry will be removed. Curated collections are kept.`} running={running} onConfirm={remove} /> : null}
      <Button label={id ? "Save changes" : "Create festival"} onPress={save} loading={running} style={styles.save} />
    </View>
  );

  return (
    <ManageStackScreen title={id ? "Edit festival" : "New festival"} actions={actions}>
      <SectionCard title="Festival">
        <TextField label="Name" required value={f.name} onChangeText={onName} error={errors.name} />
        <TextField label="Slug" required value={f.slug} onChangeText={set("slug")} autoCapitalize="none" error={errors.slug} />
        <SelectField label="Kind" required value={f.kind} options={KIND_OPTIONS} onChange={set("kind")} />
        <DateField label="Starts" required value={f.startsAt} onChange={set("startsAt")} error={errors.startsAt} />
        <DateField label="Ends" required value={f.endsAt} onChange={set("endsAt")} minDate={f.startsAt ?? undefined} error={errors.endsAt} />
        <TextField label="Lead days" required value={f.leadDays} onChangeText={set("leadDays")} keyboardType="number-pad" hint="Days before the festival that its collection goes live" error={errors.leadDays} />
      </SectionCard>
      <SectionCard title="Audience and curation">
        <ChipSelect label="Regions" required options={REGION_OPTIONS} value={f.regions} onChange={set("regions")} error={errors.regions} />
        <TextField label="Guidance" value={f.guidance} onChangeText={set("guidance")} multiline hint="Hints for the AI curator, e.g. vegetarian, traditional dishes" />
        <SwitchRow label="Active" value={f.isActive} onValueChange={set("isActive")} />
      </SectionCard>
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flex: 1, flexDirection: "row", gap: 10 },
  save: { flex: 2 },
});
