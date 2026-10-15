import type { ProductListItem } from "../products/types";

export interface RecipeRecord {
  id: string;
  title: string;
  slug: string;
  cuisineType: string | null;
  difficulty: string | null;
  dietType: string | null;
  isActive: boolean;
  imageUrl: string | null;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  _count: { items: number };
}

export interface RecipeDetail extends RecipeRecord {
  description: string | null;
  instructions: string[];
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  items: { productId: string; displayQty: string; note: string | null; product: ProductListItem }[];
}
