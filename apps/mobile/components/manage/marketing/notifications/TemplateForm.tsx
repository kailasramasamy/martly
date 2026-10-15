import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ManageStackScreen } from "../../ManageStackScreen";
import { SectionCard } from "../../ui/SectionCard";
import { TextField } from "../../ui/TextField";
import { SelectField } from "../../ui/SelectField";
import { ImageField } from "../../ui/ImageField";
import { Button } from "../../ui/Button";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useResource } from "../../../../lib/manage/use-resource";
import { DeleteButton } from "../common";
import { NotificationPreview } from "./NotificationPreview";
import { TYPE_OPTIONS, type Template } from "./types";

interface FormState {
  name: string;
  title: string;
  body: string;
  type: string;
  imageUrl: string | null;
}

const EMPTY: FormState = { name: "", title: "", body: "", type: "PROMOTIONAL", imageUrl: null };

export function TemplateForm({ id }: { id?: string }) {
  const { data, loading, error, reload } = useResource<Template>(id ? `/api/v1/notifications/admin/templates/${id}` : null);
  if (id && !data) {
    return <ManageStackScreen title="Edit template" loading={loading} error={error} onRetry={reload}>{null}</ManageStackScreen>;
  }
  const initial = data ? { name: data.name, title: data.title, body: data.body, type: data.type, imageUrl: data.imageUrl } : EMPTY;
  return <TemplateFields key={data?.id} initial={initial} id={id} />;
}

function TemplateFields({ initial, id }: { initial: FormState; id?: string }) {
  const router = useRouter();
  const { run, running } = useAction();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const found: typeof errors = {};
    if (!f.name.trim()) found.name = "Enter a name";
    if (!f.title.trim()) found.title = "Enter a title";
    if (!f.body.trim()) found.body = "Enter a message";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { name: f.name.trim(), title: f.title.trim(), body: f.body.trim(), type: f.type, imageUrl: f.imageUrl };
    const create = { ...body, imageUrl: f.imageUrl ?? undefined };
    const base = "/api/v1/notifications/admin/templates";
    const result = await run(() => (id ? api.put(`${base}/${id}`, body) : api.post(base, create)), id ? "Template updated" : "Template created");
    if (result) router.back();
  };
  const remove = async () => {
    if (await run(() => api.delete(`/api/v1/notifications/admin/templates/${id}`), "Template deleted")) router.back();
  };

  const actions = (
    <View style={styles.actions}>
      {id ? <DeleteButton title="Delete template?" message={`"${f.name}" will be removed. Past campaigns are not affected.`} running={running} onConfirm={remove} /> : null}
      <Button label={id ? "Save changes" : "Create template"} onPress={save} loading={running} style={styles.save} />
    </View>
  );

  return (
    <ManageStackScreen title={id ? "Edit template" : "New template"} actions={actions}>
      <SectionCard title="Template">
        <TextField label="Name" required value={f.name} onChangeText={set("name")} maxLength={200} hint="Only you see this" error={errors.name} />
        <TextField label="Title" required value={f.title} onChangeText={set("title")} maxLength={200} error={errors.title} />
        <TextField label="Message" required value={f.body} onChangeText={set("body")} multiline maxLength={2000} error={errors.body} />
        <SelectField label="Type" value={f.type} options={TYPE_OPTIONS} onChange={set("type")} />
        <ImageField label="Image" value={f.imageUrl} onChange={set("imageUrl")} aspect={2} hint="Optional" />
      </SectionCard>
      <SectionCard title="Preview"><NotificationPreview title={f.title} body={f.body} imageUrl={f.imageUrl} /></SectionCard>
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flex: 1, flexDirection: "row", gap: 10 },
  save: { flex: 2 },
});
