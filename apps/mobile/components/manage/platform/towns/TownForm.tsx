import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { INDIAN_STATES } from "@martly/shared/constants";
import { createTownSchema } from "@martly/shared/schemas";
import type { Town } from "@martly/shared/types";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useResource } from "../../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../ManageStackScreen";
import { SectionCard } from "../../ui/SectionCard";
import { TextField } from "../../ui/TextField";
import { SelectField } from "../../ui/SelectField";
import { Button } from "../../ui/Button";

interface FormState { name: string; slug: string; district: string; state: string | null }

const EMPTY: FormState = { name: "", slug: "", district: "", state: null };
const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));

type Errors = Partial<Record<keyof FormState, string>>;

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function validate(f: FormState): Errors {
  const parsed = createTownSchema.safeParse(f);
  if (parsed.success) return {};
  const errors: Errors = {};
  for (const issue of parsed.error.issues) errors[issue.path[0] as keyof FormState] ??= issue.message;
  return errors;
}

/** Create when `id` is absent, edit otherwise */
export function TownForm({ id }: { id?: string }) {
  const router = useRouter();
  const town = useResource<Town>(id ? `/api/v1/towns/${id}` : null);
  const { run, running } = useAction();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (town.data) setF({ name: town.data.name, slug: town.data.slug, district: town.data.district, state: town.data.state });
  }, [town.data]);

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));
  // Creating suggests the slug from the name; editing keeps it, since store links already use it
  const onName = (name: string) => setF((prev) => ({ ...prev, name, ...(id ? {} : { slug: slugOf(name) }) }));

  const save = async () => {
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { ...f, name: f.name.trim(), district: f.district.trim() };
    const saved = await run(() => (id ? api.put(`/api/v1/towns/${id}`, body) : api.post("/api/v1/towns", body)), id ? "Town saved" : "Town added");
    if (saved) router.back();
  };

  return (
    <ManageStackScreen
      title={id ? "Edit town" : "New town"}
      loading={town.loading}
      error={town.error}
      onRetry={town.reload}
      actions={<Button label={id ? "Save town" : "Add town"} onPress={save} loading={running} style={{ flex: 1 }} />}
    >
      <SectionCard title="Town details">
        <TextField label="Name" required value={f.name} onChangeText={onName} maxLength={60} autoCapitalize="words" error={errors.name} />
        <TextField label="Slug" required value={f.slug} onChangeText={set("slug")} autoCapitalize="none" maxLength={60} hint="The town part of a store's address: onmartly.in/{slug}/store" error={errors.slug} />
        <TextField label="District" required value={f.district} onChangeText={set("district")} maxLength={60} autoCapitalize="words" error={errors.district} />
        <SelectField label="State" required value={f.state} options={STATE_OPTIONS} onChange={set("state")} placeholder="Choose a state" error={errors.state} />
      </SectionCard>
    </ManageStackScreen>
  );
}
