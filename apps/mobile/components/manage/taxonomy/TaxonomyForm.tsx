import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { ImageField } from "../ui/ImageField";
import { Button } from "../ui/Button";
import { TagListField } from "../products/TagListField";
import { LEVEL_LABEL, levelPath } from "./paths";
import { emptyTaxonomyForm, formError, recordToForm, slugify, toPayload, type TaxonomyFormValues, type TaxonomyRecord } from "./form";
import { useTaxonomy } from "./use-taxonomy";
import type { TaxonomyLevel } from "./types";

interface TaxonomyFormProps {
  level: TaxonomyLevel;
  /** Edit this record; omit to create */
  recordId?: string;
  /** Pre-selected parent when creating from a drill-down screen */
  parentId?: string;
}

const LEVEL_OPTIONS = (Object.keys(LEVEL_LABEL) as TaxonomyLevel[]).map((value) => ({ value, label: LEVEL_LABEL[value] }));

function useTaxonomyForm({ level, recordId, parentId }: TaxonomyFormProps) {
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const { tree } = useTaxonomy();
  const [values, setValues] = useState<TaxonomyFormValues>(() => emptyTaxonomyForm(level));
  const [slugTouched, setSlugTouched] = useState(!!recordId);
  const [loading, setLoading] = useState(!!recordId);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) return;
    api.get<TaxonomyRecord>(`${levelPath(level)}/${recordId}`)
      .then((res) => setValues(recordToForm(level, res.data)))
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [level, recordId]);

  useEffect(() => {
    if (recordId || !parentId) return;
    const parentField = level === "category" ? "departmentId" : "categoryId";
    setValues((prev) => ({ ...prev, [parentField]: parentId }));
  }, [level, recordId, parentId]);

  const patch = (next: Partial<TaxonomyFormValues>) => setValues((prev) => ({ ...prev, ...next }));
  const rename = (name: string) => patch({ name, ...(slugTouched ? {} : { slug: slugify(name) }) });

  const save = async () => {
    const problem = formError(values);
    if (problem) return toast.show(problem, "error");
    const body = toPayload(values, !recordId);
    const saved = recordId
      ? await run(() => api.put(`${levelPath(values.level)}/${recordId}`, body), "Saved")
      : await run(() => api.post(levelPath(values.level), body), `${LEVEL_LABEL[values.level]} created`);
    if (saved) router.back();
  };

  const remove = async () => {
    const done = await run(() => api.delete(`${levelPath(level)}/${recordId}`), "Deleted");
    if (done) router.replace("/manage/categories");
  };

  return { values, patch, rename, setSlugTouched, save, remove, running, loading, loadError, tree };
}

type Form = ReturnType<typeof useTaxonomyForm>;

function DetailsCard({ form, level, editing }: { form: Form; level: TaxonomyLevel; editing: boolean }) {
  const { values, patch, tree } = form;
  const categories = tree.find((d) => d.id === values.departmentId)?.categories ?? [];
  return (
    <SectionCard title="Details">
      {!editing && <SelectField label="Level" value={values.level} options={LEVEL_OPTIONS} onChange={(next) => patch({ level: next as TaxonomyLevel })} />}
      {!editing && values.level !== "department" && (
        <SelectField label="Department" required value={values.departmentId} options={tree.map((d) => ({ value: d.id, label: d.name }))}
          onChange={(departmentId) => patch({ departmentId, categoryId: "" })} placeholder="Select department" />
      )}
      {!editing && values.level === "subcategory" && (
        <SelectField label="Category" required value={values.categoryId} options={categories.map((c) => ({ value: c.id, label: c.name }))}
          disabled={!values.departmentId} onChange={(categoryId) => patch({ categoryId })} placeholder="Select category" />
      )}
      <TextField label="Name" required value={values.name} onChangeText={form.rename} />
      <TextField label="Slug" required value={values.slug} autoCapitalize="none" onChangeText={(slug) => { form.setSlugTouched(true); patch({ slug }); }} />
      <TextField label="Sort order" keyboardType="number-pad" value={values.sortOrder} onChangeText={(sortOrder) => patch({ sortOrder })} hint="Lower numbers appear first" />
      {level === "subcategory" && values.level === "subcategory" && (
        <TagListField label="Search terms" value={values.searchTerms} onChange={(searchTerms) => patch({ searchTerms })} placeholder="e.g. shaving, razor" />
      )}
    </SectionCard>
  );
}

export function TaxonomyForm(props: TaxonomyFormProps) {
  const form = useTaxonomyForm(props);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = !!props.recordId;
  const noun = LEVEL_LABEL[props.level].toLowerCase();

  const actions = (
    <>
      {editing && <Button label="Delete" variant="danger" onPress={() => setConfirmDelete(true)} style={{ flex: 1 }} />}
      <Button label={editing ? "Save changes" : "Create"} onPress={form.save} loading={form.running} style={{ flex: 2 }} />
    </>
  );

  return (
    <ManageStackScreen title={`${editing ? "Edit" : "New"} ${noun}`} loading={form.loading} error={form.loadError} actions={actions}>
      <DetailsCard form={form} level={props.level} editing={editing} />
      <SectionCard title="Image"><ImageField value={form.values.imageUrl} onChange={(imageUrl) => form.patch({ imageUrl })} /></SectionCard>
      <SectionCard title="Tamil translation">
        <TextField label="Name (Tamil)" value={form.values.taName} onChangeText={(taName) => form.patch({ taName })} />
      </SectionCard>
      <ConfirmDialog
        visible={confirmDelete}
        title={`Delete ${noun}?`}
        message="Only empty items can be deleted. This cannot be undone."
        confirmLabel="Delete"
        running={form.running}
        onConfirm={async () => { await form.remove(); setConfirmDelete(false); }}
        onClose={() => setConfirmDelete(false)}
      />
    </ManageStackScreen>
  );
}
