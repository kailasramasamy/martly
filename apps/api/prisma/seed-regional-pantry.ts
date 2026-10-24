/**
 * "Regional pantry picks": South Indian kitchen brands the store stocks, in pantry aisles, best sellers first and no
 * brand more than three times in the first dozen. Placed as the first shelf below the hero banners. Safe to rerun.
 * Run: npx tsx prisma/seed-regional-pantry.ts   (point DATABASE_URL at the target DB)
 */
import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/client.js";
import { ORG_NAME, STORE_ID, placeSection, upsertCollection } from "./seed-home-collections.js";

const databaseUrl = process.env.DATABASE_URL;
dotenv.config({ override: true });
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient();

const BRANDS = [
  "MTR", "Sakthi Masala", "Eastern", "GRB", "Aavin", "Cavin's", "Cookme", "Narasu's", "Cothas Coffee", "Leo Coffee",
  "Sri Bhagyalakshmi", "Gold Winner", "Idhayam", "Naga", "Hatsun", "Dodla", "Aachi",
];
const CATEGORIES = [
  "Spices & Masala", "Atta & Flours", "Dal & Pulses", "Rice", "Edible Oils", "Ghee", "Pickles & Chutney", "Coffee", "Papad & Fryums",
];
const MAX_PRODUCTS = 40;
const LEAD = 12;
const PER_BRAND_IN_LEAD = 3;

async function rankedProducts() {
  return prisma.$queryRaw<{ id: string; brand: string }[]>`
    SELECT p.id, b.name AS brand
    FROM products p
    JOIN brands b ON b.id = p.brand_id AND b.name = ANY(${BRANDS}::text[])
    JOIN subcategories s ON s.id = p.subcategory_id
    JOIN categories c ON c.id = s.category_id AND c.name = ANY(${CATEGORIES}::text[])
    JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ${STORE_ID} AND sp.is_active AND sp.stock > 0
    LEFT JOIN (
      SELECT oi.product_id, SUM(oi.quantity) AS qty FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = ${STORE_ID} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '30 days'
      GROUP BY oi.product_id
    ) sales ON sales.product_id = p.id
    WHERE p.is_active AND p.image_url IS NOT NULL
    GROUP BY p.id, b.name, sales.qty
    ORDER BY COALESCE(sales.qty, 0) DESC, SUM(sp.stock) DESC, p.id`;
}

// The first dozen hold at most three of any brand; the rest follow in rank order
function spreadBrands(ranked: { id: string; brand: string }[]) {
  const lead: string[] = [];
  const perBrand = new Map<string, number>();
  for (const p of ranked) {
    if (lead.length === LEAD) break;
    const count = perBrand.get(p.brand) ?? 0;
    if (count < PER_BRAND_IN_LEAD) { lead.push(p.id); perBrand.set(p.brand, count + 1); }
  }
  const rest = ranked.map((p) => p.id).filter((id) => !lead.includes(id));
  return [...lead, ...rest].slice(0, MAX_PRODUCTS);
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { name: ORG_NAME }, select: { id: true } });
  const ids = spreadBrands(await rankedProducts());
  const { collection } = await upsertCollection(prisma, org.id, {
    slug: "regional-pantry-picks-demo-grocers", title: "Regional pantry picks", subtitle: "South Indian kitchen favourites",
    kind: "STANDARD", groups: [ids],
  });
  await placeSection(prisma, org.id, "HERO_BANNERS", {
    type: "PRODUCT_ROW", title: "Regional pantry picks", subtitle: "South Indian kitchen favourites", collectionId: collection.id,
    config: { headerStyle: "PLAIN" },
  });
  console.log(`Regional pantry picks: ${ids.length} products`);
}

main().finally(() => prisma.$disconnect());
