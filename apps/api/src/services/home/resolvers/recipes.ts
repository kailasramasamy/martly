import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { StoreRef } from "../types.js";

const RECIPE_LIMIT = 6;

/** Active recipes with how many of their ingredients this store can supply. */
export async function recipeSummaries(prisma: PrismaClient, store: StoreRef) {
  const rows = await prisma.recipe.findMany({
    where: { isActive: true, OR: [{ organizationId: store.organizationId }, { organizationId: null }] },
    orderBy: { sortOrder: "asc" },
    take: RECIPE_LIMIT,
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: { include: { storeProducts: { where: { storeId: store.id, isActive: true }, orderBy: { price: "asc" }, take: 1 } } } },
      },
    },
  });
  return rows.map((recipe) => {
    const stocked = recipe.items.flatMap((item) => item.product.storeProducts.slice(0, 1));
    const estimatedTotal = stocked.reduce((sum, sp) => sum + Number(sp.price), 0);
    return {
      id: recipe.id, title: recipe.title, slug: recipe.slug, imageUrl: recipe.imageUrl, difficulty: recipe.difficulty,
      cuisineType: recipe.cuisineType, dietType: recipe.dietType, prepTime: recipe.prepTime, cookTime: recipe.cookTime,
      servings: recipe.servings, translations: recipe.translations, ingredientCount: recipe.items.length,
      availableCount: stocked.length, estimatedTotal: Math.round(estimatedTotal * 100) / 100,
    };
  });
}
