import { useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { EDITABLE_COLLECTION_KINDS, CollectionKindLabels } from "@martly/shared/constants";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { colors, fonts } from "../../../constants/theme";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { SwitchRow } from "../ui/SwitchRow";
import { DateField } from "../ui/DateField";
import { ImageField } from "../ui/ImageField";
import { Button } from "../ui/Button";
import { slugify } from "../taxonomy/form";
import { CollectionProductsCard } from "./CollectionProductsCard";
import { collectionFormError, collectionPayload, collectionToForm, emptyCollectionForm, type CollectionFormValues } from "./form";
import type { CollectionDetail } from "./types";

const KIND_OPTIONS = EDITABLE_COLLECTION_KINDS.map((value) => ({ value, label: CollectionKindLabels[value] }));

function ScheduleDate({ label, value, placeholder, minDate, onChange }: { label: string; value: string | null; placeholder: string; minDate?: string; onChange: (key: string | null) => void }) {
  return (
    <View>
      <DateField label={label} value={value} placeholder={placeholder} minDate={minDate} onChange={onChange} />
      {value ? (
        <TouchableOpacity style={styles.clear} onPress={() => onChange(null)} hitSlop={8}>
          <Text style={styles.clearText}>Clear {label.toLowerCase()}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function useCollectionForm(collection?: CollectionDetail) {
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const [values, setValues] = useState<CollectionFormValues>(() => (collection ? collectionToForm(collection) : emptyCollectionForm()));
  const [slugTouched, setSlugTouched] = useState(!!collection);
  const patch = (next: Partial<CollectionFormValues>) => setValues((prev) => ({ ...prev, ...next }));
  const retitle = (title: string) => patch({ title, ...(slugTouched ? {} : { slug: slugify(title) }) });

  const save = async () => {
    const problem = collectionFormError(values);
    if (problem) return toast.show(problem, "error");
    const body = collectionPayload(values, !collection);
    const saved = collection
      ? await run(() => api.put(`/api/v1/collections/${collection.id}`, body), "Collection saved")
      : await run(() => api.post("/api/v1/collections", body), "Collection created");
    if (saved) router.back();
  };

  const remove = async () => {
    const done = await run(() => api.delete(`/api/v1/collections/${collection?.id}`), "Collection deleted");
    if (done) router.replace("/manage/collections");
  };

  return { values, patch, retitle, editSlug: (slug: string) => { setSlugTouched(true); patch({ slug }); }, save, remove, running };
}

export function CollectionForm({ collection }: { collection?: CollectionDetail }) {
  const form = useCollectionForm(collection);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { values, patch } = form;

  const actions = (
    <>
      {collection && <Button label="Delete" variant="danger" onPress={() => setConfirmDelete(true)} style={styles.delete} />}
      <Button label={collection ? "Save changes" : "Create collection"} onPress={form.save} loading={form.running} style={styles.save} />
    </>
  );

  return (
    <ManageStackScreen title={collection ? "Edit collection" : "New collection"} actions={actions}>
      <SectionCard title="Collection details">
        <TextField label="Title" required value={values.title} onChangeText={form.retitle} />
        <TextField label="Slug" required value={values.slug} onChangeText={form.editSlug} autoCapitalize="none" />
        <TextField label="Subtitle" value={values.subtitle} onChangeText={(subtitle) => patch({ subtitle })} />
        <SelectField label="Kind" value={values.kind} options={KIND_OPTIONS} onChange={(kind) => patch({ kind })} />
        <ScheduleDate label="Starts" value={values.startsAt} placeholder="Immediately" onChange={(startsAt) => patch({ startsAt })} />
        <ScheduleDate label="Ends" value={values.endsAt} placeholder="No end date" minDate={values.startsAt ?? undefined} onChange={(endsAt) => patch({ endsAt })} />
        <TextField label="Sort order" keyboardType="number-pad" value={values.sortOrder} onChangeText={(sortOrder) => patch({ sortOrder })} hint="Leave empty to add at the end" />
        <SwitchRow label="Active" value={values.isActive} onValueChange={(isActive) => patch({ isActive })} />
      </SectionCard>
      <SectionCard title="Cover image"><ImageField value={values.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} aspect={2} /></SectionCard>
      <CollectionProductsCard products={values.products} onChange={(products) => patch({ products })} />
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete collection?"
        message="Its banners are removed too. This cannot be undone."
        confirmLabel="Delete"
        running={form.running}
        onConfirm={async () => { await form.remove(); setConfirmDelete(false); }}
        onClose={() => setConfirmDelete(false)}
      />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  clear: { marginTop: -8, marginBottom: 12 },
  clearText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  delete: { flex: 1 },
  save: { flex: 2 },
});
