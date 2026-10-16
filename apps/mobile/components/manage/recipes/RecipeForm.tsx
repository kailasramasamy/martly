import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { DifficultyLabels, FoodTypeLabels } from "@martly/shared/constants";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import type { SelectOption } from "../ui/OptionSheet";
import { SwitchRow } from "../ui/SwitchRow";
import { ImageField } from "../ui/ImageField";
import { Button } from "../ui/Button";
import { slugify } from "../taxonomy/form";
import { IngredientsCard } from "./IngredientsCard";
import { InstructionsCard } from "./InstructionsCard";
import { emptyRecipeForm, recipeFormError, recipePayload, recipeToForm, type RecipeFormValues } from "./form";
import type { RecipeDetail } from "./types";

const toOptions = (labels: Record<string, string>, none: string): SelectOption[] => [
  { value: "", label: none },
  ...Object.entries(labels).map(([value, label]) => ({ value, label })),
];
const DIFFICULTY_OPTIONS = toOptions(DifficultyLabels, "Not set");
const DIET_OPTIONS = toOptions(FoodTypeLabels, "Not set");

function useRecipeForm(recipe?: RecipeDetail) {
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const [values, setValues] = useState<RecipeFormValues>(() => (recipe ? recipeToForm(recipe) : emptyRecipeForm()));
  const [slugTouched, setSlugTouched] = useState(!!recipe);
  const patch = (next: Partial<RecipeFormValues>) => setValues((prev) => ({ ...prev, ...next }));

  const save = async () => {
    const problem = recipeFormError(values);
    if (problem) return toast.show(problem, "error");
    const body = recipePayload(values, !recipe);
    const saved = recipe
      ? await run(() => api.put(`/api/v1/recipes/${recipe.id}`, body), "Recipe saved")
      : await run(() => api.post("/api/v1/recipes", body), "Recipe created");
    if (saved) router.back();
  };

  const remove = async () => {
    const done = await run(() => api.delete(`/api/v1/recipes/${recipe?.id}`), "Recipe deleted");
    if (done) router.replace("/manage/recipes");
  };

  return {
    values, patch, save, remove, running,
    retitle: (title: string) => patch({ title, ...(slugTouched ? {} : { slug: slugify(title) }) }),
    editSlug: (slug: string) => { setSlugTouched(true); patch({ slug }); },
  };
}

function DetailsCard({ form }: { form: ReturnType<typeof useRecipeForm> }) {
  const { values, patch } = form;
  return (
    <SectionCard title="Recipe details">
      <TextField label="Title" required value={values.title} onChangeText={form.retitle} />
      <TextField label="Slug" required value={values.slug} onChangeText={form.editSlug} autoCapitalize="none" />
      <TextField label="Description" multiline value={values.description} onChangeText={(description) => patch({ description })} />
      <View style={styles.trio}>
        <View style={styles.third}><TextField label="Prep" suffix="min" keyboardType="number-pad" value={values.prepTime} onChangeText={(prepTime) => patch({ prepTime })} /></View>
        <View style={styles.third}><TextField label="Cook" suffix="min" keyboardType="number-pad" value={values.cookTime} onChangeText={(cookTime) => patch({ cookTime })} /></View>
        <View style={styles.third}><TextField label="Serves" keyboardType="number-pad" value={values.servings} onChangeText={(servings) => patch({ servings })} /></View>
      </View>
      <SelectField label="Difficulty" value={values.difficulty} options={DIFFICULTY_OPTIONS} onChange={(difficulty) => patch({ difficulty })} />
      <SelectField label="Diet type" value={values.dietType} options={DIET_OPTIONS} onChange={(dietType) => patch({ dietType })} />
      <TextField label="Cuisine" value={values.cuisineType} onChangeText={(cuisineType) => patch({ cuisineType })} placeholder="e.g. South Indian" />
      <SwitchRow label="Active" value={values.isActive} onValueChange={(isActive) => patch({ isActive })} />
    </SectionCard>
  );
}

export function RecipeForm({ recipe }: { recipe?: RecipeDetail }) {
  const form = useRecipeForm(recipe);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const actions = (
    <>
      {recipe && <Button label="Delete" variant="danger" onPress={() => setConfirmDelete(true)} style={styles.delete} />}
      <Button label={recipe ? "Save changes" : "Create recipe"} onPress={form.save} loading={form.running} style={styles.save} />
    </>
  );

  return (
    <ManageStackScreen title={recipe ? "Edit recipe" : "New recipe"} actions={actions}>
      <DetailsCard form={form} />
      <SectionCard title="Cover image"><ImageField value={form.values.imageUrl} onChange={(imageUrl) => form.patch({ imageUrl })} aspect={1.6} /></SectionCard>
      <IngredientsCard items={form.values.items} onChange={(items) => form.patch({ items })} />
      <InstructionsCard steps={form.values.instructions} onChange={(instructions) => form.patch({ instructions })} />
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete recipe?"
        message="This cannot be undone."
        confirmLabel="Delete"
        running={form.running}
        onConfirm={async () => { await form.remove(); setConfirmDelete(false); }}
        onClose={() => setConfirmDelete(false)}
      />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  trio: { flexDirection: "row", gap: 10 },
  third: { flex: 1 },
  delete: { flex: 1 },
  save: { flex: 2 },
});
