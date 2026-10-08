/**
 * Remove tobacco products from the catalog (App Store Guideline 1.4.3 forbids facilitating tobacco sales).
 * Deletes the "Chewing Tobacco" subcategory and its products, and renames the parent category
 * "Paan Masala & Tobacco" → "Paan Masala & Mouth Fresheners". Idempotent; refuses to run if any
 * of the products has been ordered or reviewed (those records must be kept).
 * Run: cd apps/api && npx tsx prisma/remove-tobacco.ts
 */

import { PrismaClient, Prisma } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const SUBCATEGORY = "Chewing Tobacco";
const OLD_CATEGORY = "Paan Masala & Tobacco";
const NEW_CATEGORY = { name: "Paan Masala & Mouth Fresheners", slug: "paan-masala-mouth-fresheners", ta: "பான் மசாலா & வாய் புத்துணர்ச்சி" };

async function renameCategory(tx: Prisma.TransactionClient) {
  const category = await tx.category.findFirst({ where: { name: OLD_CATEGORY } });
  if (!category) return false;
  const translations = (category.translations ?? {}) as Record<string, { name?: string }>;
  await tx.category.update({
    where: { id: category.id },
    data: { name: NEW_CATEGORY.name, slug: NEW_CATEGORY.slug, translations: { ...translations, ta: { ...translations.ta, name: NEW_CATEGORY.ta } } },
  });
  return true;
}

async function main() {
  const subcategories = await prisma.subcategory.findMany({ where: { name: SUBCATEGORY }, select: { id: true } });
  const products = await prisma.product.findMany({
    where: { subcategoryId: { in: subcategories.map((s) => s.id) } },
    select: { id: true, name: true, _count: { select: { orderItems: true, reviews: true } } },
  });
  const blocked = products.filter((p) => p._count.orderItems > 0 || p._count.reviews > 0);
  if (blocked.length) throw new Error(`Ordered/reviewed products, not deleting: ${blocked.map((p) => p.name).join(", ")}`);

  const productIds = products.map((p) => p.id);
  const result = await prisma.$transaction(async (tx) => {
    const stock = await tx.storeProduct.deleteMany({ where: { productId: { in: productIds } } });
    const deleted = await tx.product.deleteMany({ where: { id: { in: productIds } } });
    const subs = await tx.subcategory.deleteMany({ where: { id: { in: subcategories.map((s) => s.id) } } });
    const renamed = await renameCategory(tx);
    return { stock: stock.count, products: deleted.count, subcategories: subs.count, renamed };
  });

  console.log(`✔ Removed ${result.products} products (${products.map((p) => p.name).join(", ") || "none"}), ` +
    `${result.stock} store listings, ${result.subcategories} subcategory; category renamed: ${result.renamed}`);
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
