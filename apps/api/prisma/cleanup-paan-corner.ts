/**
 * Clean up Paan Corner: delete the demo placeholder products seeded in March (invented names, MRPs and
 * mismatched images), fold "Gutkha-Free Supari" into "Flavoured Supari", drop the "Paan Masala" subcategory
 * and its tobacco-flavoured parent category (App Store Guideline 1.4.3), and delete brands left empty.
 * Idempotent; refuses to run if a placeholder has been ordered, reviewed or subscribed to.
 * Run: cd apps/api && npx tsx prisma/cleanup-paan-corner.ts [--apply]
 */

import { PrismaClient, Prisma } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const PLACEHOLDERS = [
  "Catch Flavoured Saunf (Fennel Seeds)",
  "DS Group Premium Elaichi (Cardamom)",
  "Frost Sweet Betel Nut Supari",
  "Mahak Meethi Saunf (Sweet Fennel)",
  "Mahak Plain Saunf (Fennel Seeds)",
  "Pass Pass Pulse Mukhwas Mix",
  "Pass Pass Pulse Tangy Twist Candy",
  "Shahi Mix Mukhwas",
  "Silver-Coated Elaichi (Cardamom)",
];
const EMPTY_BRANDS = ["DS Group", "Frost", "Mahak", "Shahi"];
const OLD_CATEGORY = "Paan Masala & Mouth Fresheners";
const FOLD = { from: "Gutkha-Free Supari", into: "Flavoured Supari" };

async function placeholders() {
  const products = await prisma.product.findMany({
    where: { name: { in: PLACEHOLDERS }, organizationId: null, subcategory: { category: { department: { name: "Paan Corner" } } } },
    select: { id: true, name: true, _count: { select: { orderItems: true, reviews: true } } },
  });
  const blocked = products.filter((p) => p._count.orderItems > 0 || p._count.reviews > 0);
  if (blocked.length) throw new Error(`Ordered/reviewed products, not deleting: ${blocked.map((p) => p.name).join(", ")}`);
  const subscribed = await prisma.subscriptionItem.count({ where: { storeProduct: { productId: { in: products.map((p) => p.id) } } } });
  if (subscribed) throw new Error(`${subscribed} subscription items use these products, not deleting`);
  return products;
}

async function cleanTaxonomy(tx: Prisma.TransactionClient) {
  const category = await tx.category.findFirst({ where: { name: OLD_CATEGORY, department: { name: "Paan Corner" } }, include: { subcategories: true } });
  if (!category) return { moved: 0, subcategories: 0, category: 0 };
  const target = await tx.subcategory.findFirstOrThrow({ where: { name: FOLD.into, category: { department: { name: "Paan Corner" } } } });
  const ids = category.subcategories.map((s) => s.id);
  const moved = await tx.product.updateMany({ where: { subcategoryId: { in: ids } }, data: { subcategoryId: target.id } });
  await tx.banner.updateMany({ where: { subcategoryId: { in: ids } }, data: { subcategoryId: target.id } });
  await tx.banner.updateMany({ where: { categoryId: category.id }, data: { categoryId: target.categoryId } });
  await tx.brandCampaign.updateMany({ where: { categoryId: category.id }, data: { categoryId: target.categoryId } });
  const subs = await tx.subcategory.deleteMany({ where: { id: { in: ids } } });
  await tx.category.delete({ where: { id: category.id } });
  return { moved: moved.count, subcategories: subs.count, category: 1 };
}

async function main() {
  const products = await placeholders();
  console.log(`Placeholders found: ${products.length}/${PLACEHOLDERS.length}`);
  if (!apply) return console.log("Dry run — pass --apply to delete");

  const productIds = products.map((p) => p.id);
  const result = await prisma.$transaction(async (tx) => {
    const listings = await tx.storeProduct.deleteMany({ where: { productId: { in: productIds } } });
    const deleted = await tx.product.deleteMany({ where: { id: { in: productIds } } });
    const taxonomy = await cleanTaxonomy(tx);
    const brands = await tx.brand.deleteMany({ where: { name: { in: EMPTY_BRANDS }, products: { none: {} }, campaigns: { none: {} } } });
    return { listings: listings.count, products: deleted.count, ...taxonomy, brands: brands.count };
  });
  console.log(`✔ Removed ${result.products} placeholder products, ${result.listings} store listings; ` +
    `moved ${result.moved} products into ${FOLD.into}; deleted ${result.subcategories} subcategories, ` +
    `${result.category} category, ${result.brands} empty brands`);
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
