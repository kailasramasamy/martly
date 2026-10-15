import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { ImageField } from "../ui/ImageField";
import { Button } from "../ui/Button";
import { slugify } from "./form";
import { brandFormError, brandPayload, brandToForm, emptyBrandForm, type BrandFormValues } from "./brand-form";
import type { BrandRecord } from "./brand-types";

const HEX = /^#[0-9a-fA-F]{6}$/;

function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <TextField label={label} value={value} onChangeText={onChange} autoCapitalize="none" maxLength={7} placeholder="#0d9488"
      suffix={HEX.test(value) ? "■" : undefined} />
  );
}

function useBrandForm(brandId?: string) {
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const [values, setValues] = useState<BrandFormValues>(emptyBrandForm);
  const [slugTouched, setSlugTouched] = useState(!!brandId);
  const [loading, setLoading] = useState(!!brandId);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!brandId) return;
    api.get<BrandRecord>(`/api/v1/brands/${brandId}`)
      .then((res) => setValues(brandToForm(res.data)))
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [brandId]);

  const patch = (next: Partial<BrandFormValues>) => setValues((prev) => ({ ...prev, ...next }));
  const rename = (name: string) => patch({ name, ...(slugTouched ? {} : { slug: slugify(name) }) });
  const editSlug = (slug: string) => {
    setSlugTouched(true);
    patch({ slug });
  };

  const save = async () => {
    const problem = brandFormError(values);
    if (problem) return toast.show(problem, "error");
    const body = brandPayload(values, !brandId);
    const saved = brandId
      ? await run(() => api.put(`/api/v1/brands/${brandId}`, body), "Brand saved")
      : await run(() => api.post("/api/v1/brands", body), "Brand created");
    if (saved) router.back();
  };

  const remove = async () => {
    const done = await run(() => api.delete(`/api/v1/brands/${brandId}`), "Brand deleted");
    if (done) router.replace("/manage/brands");
  };

  return { values, patch, rename, editSlug, save, remove, running, loading, loadError };
}

export function BrandForm({ brandId }: { brandId?: string }) {
  const form = useBrandForm(brandId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { values, patch } = form;

  const actions = (
    <>
      {brandId && <Button label="Delete" variant="danger" onPress={() => setConfirmDelete(true)} style={styles.delete} />}
      <Button label={brandId ? "Save changes" : "Create brand"} onPress={form.save} loading={form.running} style={styles.save} />
    </>
  );

  return (
    <ManageStackScreen title={brandId ? "Edit brand" : "New brand"} loading={form.loading} error={form.loadError} actions={actions}>
      <SectionCard title="Brand details">
        <TextField label="Name" required value={values.name} onChangeText={form.rename} />
        <TextField label="Slug" required value={values.slug} onChangeText={form.editSlug} autoCapitalize="none" />
        <View style={styles.pair}>
          <View style={styles.half}><ColourField label="Brand colour" value={values.themeColor} onChange={(themeColor) => patch({ themeColor })} /></View>
          <View style={styles.half}><ColourField label="Accent colour" value={values.themeColorSecondary} onChange={(themeColorSecondary) => patch({ themeColorSecondary })} /></View>
        </View>
        <TextField label="Popularity" keyboardType="number-pad" value={values.popularity} onChangeText={(popularity) => patch({ popularity })} hint="0 to 100; higher brands rank first in search" />
      </SectionCard>
      <SectionCard title="Logo"><ImageField value={values.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} aspect={2} /></SectionCard>
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete brand?"
        message="Brands that still have products can't be deleted."
        confirmLabel="Delete"
        running={form.running}
        onConfirm={async () => { await form.remove(); setConfirmDelete(false); }}
        onClose={() => setConfirmDelete(false)}
      />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  delete: { flex: 1 },
  save: { flex: 2 },
});
