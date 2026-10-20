import { memo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { SystemSection } from "@martly/shared/types";
import { colors } from "../../../../constants/theme";
import { useStrings } from "../../../../lib/i18n/use-strings";
import type { RecipeSummary } from "../../../../lib/types";
import { RecipeCard } from "../../../RecipeCard";

const H_PADDING = 16;

export const RecipesSection = memo(function RecipesSection({ section }: { section: SystemSection }) {
  const t = useStrings("home");
  const c = useStrings("common");
  const recipes = section.data.recipes as RecipeSummary[];
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t.shoppableRecipes}</Text>
          <Text style={styles.subtitle}>{t.recipesSubtitle}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/recipes" as never)} style={styles.link}>
          <Text style={styles.linkText}>{c.seeAll}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: H_PADDING, marginBottom: 14 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: "#94a3b8", marginTop: 1 },
  link: { flexDirection: "row", alignItems: "center", gap: 2 },
  linkText: { fontSize: 13, fontWeight: "600", color: colors.primary },
  rail: { paddingHorizontal: H_PADDING, gap: 12 },
});
