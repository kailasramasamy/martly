import { parseHomeSectionConfig } from "@martly/shared/schemas";
import type { CategoryDirectorySection } from "@martly/shared/types";
import { packTileImages } from "../../pack-tiles/index.js";
import { sectionBase, type ResolveContext, type SectionResolver } from "../types.js";

type Names = CategoryDirectorySection["groups"][number]["translations"];
/** Departments with the categories this store has in stock, as directory groups, in order */
export async function directoryGroups(ctx: ResolveContext, departmentIds: string[]) {
  const stocked = await ctx.prisma.$queryRaw<{ category_id: string }[]>`
    SELECT DISTINCT s.category_id FROM store_products sp
    JOIN products p ON p.id = sp.product_id AND p.is_active
    JOIN subcategories s ON s.id = p.subcategory_id
    WHERE sp.store_id = ${ctx.store.id} AND sp.is_active AND sp.stock > 0`;
  const departments = await ctx.prisma.department.findMany({
    where: departmentIds.length > 0 ? { id: { in: departmentIds } } : {},
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, translations: true,
      categories: {
        where: { id: { in: stocked.map((r) => r.category_id) } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, translations: true, imageUrl: true },
      },
    },
  });
  // A picked list keeps the admin's order
  if (departmentIds.length > 0) departments.sort((a, b) => departmentIds.indexOf(a.id) - departmentIds.indexOf(b.id));
  // Two of the store's own packs where the category has them, else the category's art
  const packTiles = await packTileImages(ctx.prisma, ctx.store.id, departments.flatMap((d) => d.categories.map((c) => c.id)));
  return departments.filter((d) => d.categories.length > 0).map((d) => ({
    departmentId: d.id, name: d.name, translations: d.translations as Names,
    tiles: d.categories.map((c) => ({
      categoryId: c.id, name: c.name, translations: c.translations as Names, imageUrl: packTiles.get(c.id) ?? c.imageUrl,
    })),
  }));
}

export const categoryDirectory: SectionResolver = async (ctx, entry) => {
  const { departmentIds } = parseHomeSectionConfig("CATEGORY_DIRECTORY", entry.config) as { departmentIds: string[] };
  const groups = await directoryGroups(ctx, departmentIds);
  return groups.length > 0 ? { ...sectionBase(entry), type: "CATEGORY_DIRECTORY", groups } : null;
};
