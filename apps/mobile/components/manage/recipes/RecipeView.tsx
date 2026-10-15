import { View, Text, StyleSheet } from "react-native";
import { DifficultyLabels, FoodTypeLabels, type Difficulty, type FoodType } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { ListRow } from "../ui/ListRow";
import type { RecipeDetail } from "./types";

const minutes = (n: number | null) => (n == null ? null : `${n} min`);

/** Read-only recipe for roles (or recipes) the user cannot edit */
export function RecipeView({ recipe }: { recipe: RecipeDetail }) {
  return (
    <>
      <SectionCard title="Recipe">
        <KeyValue label="Cuisine" value={recipe.cuisineType} />
        <KeyValue label="Difficulty" value={recipe.difficulty ? DifficultyLabels[recipe.difficulty as Difficulty] : null} />
        <KeyValue label="Diet" value={recipe.dietType ? FoodTypeLabels[recipe.dietType as FoodType] : null} />
        <KeyValue label="Prep time" value={minutes(recipe.prepTime)} />
        <KeyValue label="Cook time" value={minutes(recipe.cookTime)} />
        <KeyValue label="Serves" value={recipe.servings} />
        <KeyValue label="Scope" value={recipe.organization?.name ?? "Global"} />
        {recipe.description ? <Text style={styles.description}>{recipe.description}</Text> : null}
      </SectionCard>
      <SectionCard title={`Ingredients (${recipe.items.length})`} flush>
        {recipe.items.map((i) => (
          <ListRow key={i.productId} title={i.product.name} subtitle={[i.displayQty, i.note].filter(Boolean).join(" · ")} imageUrl={i.product.imageUrl} />
        ))}
      </SectionCard>
      <SectionCard title="Steps">
        {recipe.instructions.map((step, i) => (
          <View key={i} style={styles.step}>
            <Text style={styles.stepNo}>{i + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </SectionCard>
    </>
  );
}

const styles = StyleSheet.create({
  description: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginTop: 10 },
  step: { flexDirection: "row", gap: 10, marginBottom: 10 },
  stepNo: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.primary, width: 20 },
  stepText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
});
