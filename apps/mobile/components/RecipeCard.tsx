import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { RecipeSummary } from "../lib/types";

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "#16a34a",
  MEDIUM: "#d97706",
  HARD: "#dc2626",
};

interface RecipeCardProps {
  recipe: RecipeSummary;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const allAvailable = recipe.availableCount === recipe.ingredientCount;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
    >
      <View style={styles.imageContainer}>
        {recipe.imageUrl ? (
          <Image source={{ uri: recipe.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name="restaurant-outline" size={28} color="#94a3b8" />
          </View>
        )}
        {recipe.dietType && (
          <View
            style={[
              styles.dietBadge,
              { backgroundColor: recipe.dietType === "VEG" ? "#16a34a" : recipe.dietType === "NON_VEG" ? "#dc2626" : "#d97706" },
            ]}
          >
            <Text style={styles.dietText}>{recipe.dietType === "NON_VEG" ? "Non-Veg" : recipe.dietType === "EGG" ? "Egg" : "Veg"}</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>
        <View style={styles.metaRow}>
          {recipe.cookTime && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={12} color="#64748b" />
              <Text style={styles.metaText}>{recipe.cookTime}m</Text>
            </View>
          )}
          {recipe.difficulty && (
            <View style={styles.metaItem}>
              <View style={[styles.difficultyDot, { backgroundColor: DIFFICULTY_COLORS[recipe.difficulty] ?? "#94a3b8" }]} />
              <Text style={[styles.metaText, { color: DIFFICULTY_COLORS[recipe.difficulty] ?? "#94a3b8" }]}>
                {recipe.difficulty.charAt(0) + recipe.difficulty.slice(1).toLowerCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.footer}>
          <View style={[styles.availPill, allAvailable ? styles.availPillFull : styles.availPillPartial]}>
            <Text style={[styles.availText, allAvailable ? styles.availTextFull : styles.availTextPartial]}>
              {recipe.availableCount}/{recipe.ingredientCount}
            </Text>
          </View>
          {recipe.estimatedTotal > 0 && (
            <Text style={styles.price}>{"\u20B9"}{Math.round(recipe.estimatedTotal)}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 100,
  },
  placeholder: {
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  dietBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dietText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
  },
  content: {
    padding: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: "#64748b",
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  availPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  availPillFull: {
    backgroundColor: "#dcfce7",
  },
  availPillPartial: {
    backgroundColor: "#fef3c7",
  },
  availText: {
    fontSize: 10,
    fontWeight: "600",
  },
  availTextFull: {
    color: "#16a34a",
  },
  availTextPartial: {
    color: "#d97706",
  },
  price: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0d9488",
  },
});
