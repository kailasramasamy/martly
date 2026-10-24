import { THEME_BAND_MIN_TILES } from "@martly/shared/constants";
import { parseHomeSectionConfig } from "@martly/shared/schemas";
import type { ThemeBandSection } from "@martly/shared/types";
import { sectionBase, type SectionResolver } from "../types.js";

type Names = ThemeBandSection["tiles"][number]["translations"];

// An admin's tile label is translated as `{ ta: { label } }`; the app reads tile names as `{ ta: { name } }`
function labelNames(translations: unknown): Names {
  const labels = translations as Record<string, { label?: string }> | null;
  return labels ? Object.fromEntries(Object.entries(labels).map(([lang, t]) => [lang, { name: t.label }])) : null;
}

/**
 * A pastel band of aisle tiles. A tile shows only while its aisle has something in stock at the store, and falls back
 * to the aisle's own name and picture where the admin set none.
 */
export const themeBand: SectionResolver = async (ctx, entry) => {
  const { tint, imageUrl } = parseHomeSectionConfig("THEME_BAND", entry.config) as { tint: string; imageUrl?: string };
  const ids = entry.items.map((i) => i.subcategoryIds[0]).filter((id): id is string => !!id);
  const aisles = await ctx.prisma.subcategory.findMany({
    where: {
      id: { in: ids },
      products: { some: { isActive: true, storeProducts: { some: { storeId: ctx.store.id, isActive: true, stock: { gt: 0 } } } } },
    },
    select: { id: true, name: true, translations: true, imageUrl: true },
  });
  const byId = new Map(aisles.map((a) => [a.id, a]));
  const tiles = entry.items.flatMap((item) => {
    const aisle = byId.get(item.subcategoryIds[0]);
    if (!aisle) return [];
    const names = item.label ? labelNames(item.translations) : aisle.translations as Names;
    return [{ id: item.id, label: item.label || aisle.name, translations: names, imageUrl: item.imageUrl ?? aisle.imageUrl, subcategoryId: aisle.id }];
  });
  if (tiles.length < THEME_BAND_MIN_TILES) return null;
  return { ...sectionBase(entry), type: "THEME_BAND", tint, imageUrl: imageUrl ?? null, tiles };
};
