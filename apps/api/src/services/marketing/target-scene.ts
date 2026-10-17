import type { PrismaClient } from "../../../generated/prisma/client.js";

const list = (names: string[]) => [...new Set(names)].slice(0, 6).join(", ");

/** A department, category or subcategory id, described with its place in the aisle */
async function categoryScene(prisma: PrismaClient, id: string) {
  const sub = await prisma.subcategory.findUnique({ where: { id }, select: { name: true, category: { select: { name: true } } } });
  if (sub) return `${sub.name} (${sub.category.name})`;
  const cat = await prisma.category.findUnique({ where: { id }, select: { name: true, subcategories: { select: { name: true }, take: 6 } } });
  if (cat) return `${cat.name}: ${list(cat.subcategories.map((s) => s.name))}`;
  const dept = await prisma.department.findUnique({ where: { id }, select: { name: true, categories: { select: { name: true }, take: 6 } } });
  return dept ? `${dept.name}: ${list(dept.categories.map((c) => c.name))}` : null;
}

async function productScene(prisma: PrismaClient, organizationId: string | null, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, ...(organizationId ? { OR: [{ organizationId }, { organizationId: null }] } : {}) },
    select: { name: true, subcategory: { select: { name: true } } },
  });
  return product && `${product.name}${product.subcategory ? ` (${product.subcategory.name})` : ""}`;
}

async function collectionScene(prisma: PrismaClient, organizationId: string | null, id: string) {
  const collection = await prisma.collection.findFirst({
    where: { id, ...(organizationId ? { OR: [{ organizationId }, { organizationId: null }] } : {}) },
    select: { title: true, items: { orderBy: { sortOrder: "asc" }, take: 6, select: { product: { select: { name: true } } } } },
  });
  return collection && `${collection.title}: ${list(collection.items.map((i) => i.product.name))}`;
}

/** What a brand sells (its kinds of products, never its logo or packs) */
async function brandScene(prisma: PrismaClient, id: string) {
  const products = await prisma.product.findMany({
    where: { brandId: id, subcategoryId: { not: null } }, take: 40, select: { subcategory: { select: { name: true } } },
  });
  return products.length ? list(products.map((p) => p.subcategory!.name)) : null;
}

/**
 * What the banner's picture should show when the owner leaves the description empty: the products behind the
 * banner's tap target. Null when the target says nothing useful (no action, a URL, or an unknown id).
 */
export async function targetScene(prisma: PrismaClient, organizationId: string | null, actionType?: string | null, actionTarget?: string | null) {
  const target = actionTarget?.trim();
  if (!target) return null;
  const subject = await (actionType === "CATEGORY" ? categoryScene(prisma, target)
    : actionType === "PRODUCT" ? productScene(prisma, organizationId, target)
    : actionType === "COLLECTION" ? collectionScene(prisma, organizationId, target)
    : actionType === "BRAND" ? brandScene(prisma, target)
    : actionType === "SEARCH" ? Promise.resolve(target)
    : Promise.resolve(null));
  return subject ? `Appetising, real groceries of this kind: ${subject}. Show the products themselves, unbranded.` : null;
}
