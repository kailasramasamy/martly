import type { RecipeDetail } from "./types";

export interface IngredientValues {
  productId: string;
  productName: string;
  displayQty: string;
  note: string;
}

export interface RecipeFormValues {
  title: string;
  slug: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  difficulty: string;
  cuisineType: string;
  dietType: string;
  isActive: boolean;
  imageUrl: string | null;
  items: IngredientValues[];
  instructions: string[];
}

export const emptyRecipeForm = (): RecipeFormValues => ({
  title: "", slug: "", description: "", prepTime: "", cookTime: "", servings: "", difficulty: "", cuisineType: "",
  dietType: "", isActive: true, imageUrl: null, items: [], instructions: [""],
});

export function recipeToForm(r: RecipeDetail): RecipeFormValues {
  return {
    title: r.title, slug: r.slug, description: r.description ?? "",
    prepTime: r.prepTime == null ? "" : String(r.prepTime), cookTime: r.cookTime == null ? "" : String(r.cookTime),
    servings: r.servings == null ? "" : String(r.servings), difficulty: r.difficulty ?? "", cuisineType: r.cuisineType ?? "",
    dietType: r.dietType ?? "", isActive: r.isActive, imageUrl: r.imageUrl,
    items: r.items.map((i) => ({ productId: i.productId, productName: i.product.name, displayQty: i.displayQty, note: i.note ?? "" })),
    instructions: r.instructions.length > 0 ? r.instructions : [""],
  };
}

const isPositiveInt = (v: string) => v === "" || (Number.isInteger(Number(v)) && Number(v) > 0);

export function recipeFormError(v: RecipeFormValues): string | null {
  if (!v.title.trim()) return "Title is required";
  if (!/^[a-z0-9-]+$/.test(v.slug)) return "Slug may only use lowercase letters, numbers and dashes";
  if (![v.prepTime, v.cookTime, v.servings].every(isPositiveInt)) return "Times and servings must be whole numbers above 0";
  if (v.items.some((i) => !i.displayQty.trim())) return "Every ingredient needs a quantity";
  return null;
}

export function recipePayload(v: RecipeFormValues, creating: boolean) {
  const num = (s: string) => (s === "" ? (creating ? undefined : null) : Number(s));
  const text = (s: string) => (s.trim() === "" ? (creating ? undefined : null) : s.trim());
  return {
    title: v.title.trim(),
    slug: v.slug,
    description: text(v.description),
    prepTime: num(v.prepTime),
    cookTime: num(v.cookTime),
    servings: num(v.servings),
    difficulty: v.difficulty || (creating ? undefined : null),
    cuisineType: text(v.cuisineType),
    dietType: v.dietType || (creating ? undefined : null),
    isActive: v.isActive,
    imageUrl: v.imageUrl ?? (creating ? undefined : null),
    instructions: v.instructions.map((s) => s.trim()).filter(Boolean),
    items: v.items.map((i) => ({ productId: i.productId, displayQty: i.displayQty.trim(), note: i.note.trim() || null })),
  };
}
