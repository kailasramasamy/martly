/**
 * Aisles for unbranded household items measured in stores: steel vessels, cutlery, plastic household, mats.
 * Idempotent by slug. Follow with seed-search-intents.ts, and taxonomy-images for the tiles (docs/taxonomy-images.md).
 *
 *   cd apps/api && npx tsx prisma/seed-kitchenware-aisles.ts
 */
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

const DEPARTMENT = { slug: "kitchenware-home-needs", name: "Kitchenware & Home Needs", ta: "சமையல் பாத்திரங்கள் & வீட்டுப் பொருட்கள்", sortOrder: 16 };

const CATEGORIES = [
  {
    slug: "steel-vessels", name: "Steel Vessels", ta: "எவர்சில்வர் பாத்திரங்கள்",
    subcategories: [
      { slug: "steel-vessels-dabbas-containers", name: "Dabbas & Containers", ta: "டப்பாக்கள் & கொள்கலன்கள்" },
      { slug: "steel-vessels-cooking-vessels", name: "Cooking Vessels", ta: "சமையல் பாத்திரங்கள்" },
      { slug: "steel-vessels-plates-bowls", name: "Plates & Bowls", ta: "தட்டுகள் & கிண்ணங்கள்" },
      { slug: "steel-vessels-tumblers-glasses", name: "Tumblers & Glasses", ta: "டம்ளர்கள் & கிளாஸ்கள்" },
    ],
  },
  {
    slug: "cutlery", name: "Cutlery", ta: "கரண்டிகள்",
    subcategories: [
      { slug: "cutlery-spoons", name: "Spoons", ta: "ஸ்பூன்கள்" },
      { slug: "cutlery-ladles-serving", name: "Ladles & Serving", ta: "அகப்பைகள் & பரிமாறும் கரண்டிகள்" },
    ],
  },
  {
    slug: "plastic-household", name: "Plastic Household", ta: "பிளாஸ்டிக் வீட்டுப் பொருட்கள்",
    subcategories: [
      { slug: "plastic-household-buckets-mugs", name: "Buckets & Mugs", ta: "வாளிகள் & மக்குகள்" },
      { slug: "plastic-household-tubs-baskets", name: "Tubs & Baskets", ta: "தொட்டிகள் & கூடைகள்" },
      { slug: "plastic-household-storage-containers", name: "Storage Containers", ta: "சேமிப்பு கொள்கலன்கள்" },
    ],
  },
  {
    slug: "mats", name: "Mats", ta: "மிதியடிகள்",
    subcategories: [
      { slug: "mats-door-mats", name: "Door Mats", ta: "வாசல் மிதியடிகள்" },
      { slug: "mats-floor-bath-mats", name: "Floor & Bath Mats", ta: "தரை & குளியலறை மிதியடிகள்" },
    ],
  },
];

const ta = (name: string) => ({ ta: { name } });

const { slug, name, sortOrder } = DEPARTMENT;
const department = await prisma.department.upsert({
  where: { slug },
  create: { slug, name, sortOrder, translations: ta(DEPARTMENT.ta) },
  update: { name, translations: ta(DEPARTMENT.ta) },
});

for (const [c, category] of CATEGORIES.entries()) {
  const row = { name: category.name, departmentId: department.id, sortOrder: c, translations: ta(category.ta) };
  const { id: categoryId } = await prisma.category.upsert({ where: { slug: category.slug }, create: { slug: category.slug, ...row }, update: row });
  for (const [s, sub] of category.subcategories.entries()) {
    // Vessels and mats last for years, so they don't belong in the customer's restock suggestions
    const subRow = { name: sub.name, categoryId, sortOrder: s, restockable: false, translations: ta(sub.ta) };
    await prisma.subcategory.upsert({ where: { slug: sub.slug }, create: { slug: sub.slug, ...subRow }, update: subRow });
  }
}
console.log(`${department.name}: ${CATEGORIES.length} categories, ${CATEGORIES.flatMap((c) => c.subcategories).length} subcategories`);
await prisma.$disconnect();
