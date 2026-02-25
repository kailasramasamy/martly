/**
 * Fetch Unsplash images for products that have no imageUrl.
 * Targets products in the time-based recommendation categories.
 */
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

// Brand names to strip from product names for better search queries
// Sorted longest-first at runtime to avoid partial matches
const BRAND_NAMES = [
  "ITC Master Chef", "Kitchens of India", "Real Fruit Power",
  "Kwality Wall's", "Kwality Walls", "Kwality Wall",
  "Baskin Robbins", "Ferrero Rocher", "Mother Dairy",
  "Brooke Bond", "Dark Fantasy", "English Oven",
  "Harvest Gold", "Nature Fresh", "Uncle Chipps",
  "Country Fresh", "Farm Fresh", "Happy Hens",
  "Red Label", "Taj Mahal", "Haldiram's", "Haldiram",
  "Bikaner's", "Bikaner", "Britannia", "McVitie's",
  "McVitie", "Paper Boat", "Tropicana", "B Natural",
  "Sunfeast", "Pringles", "Kurkure", "Nescafe",
  "Cadbury", "Fortune", "Saffola", "Snickers",
  "Nandini", "Organic", "Nestle", "KitKat",
  "Godrej", "Yummiez", "Sumeru", "McCain",
  "Modern", "Bikaji", "5 Star", "Bingo",
  "Parle", "Oreo", "Amul", "Tata", "Dhara",
  "Gits", "MTR", "ITC", "Bru", "Lay's", "a+",
];

// Manual overrides for product names where auto-simplification doesn't work well
const MANUAL_QUERY_MAP: Record<string, string> = {
  "Amul Pure Ghee": "ghee jar",
  "Amul Salted Butter": "salted butter",
  "Bikaji Bhujia Sev": "indian namkeen snack bowl",
  "Bingo Mad Angles Achaari Masti": "triangle chips snack",
  "Dhara Kachi Ghani Mustard Oil": "mustard oil bottle",
  "Ferrero Rocher Pack of 16": "ferrero rocher chocolate",
  "Fortune Rice Bran Health Oil": "rice bran oil bottle",
  "Fresh Orange (Nagpur)": "fresh orange fruit",
  "Haldiram's Gulab Jamun Tin": "gulab jamun indian sweet",
  "Haldiram's Navratan Mixture": "indian namkeen mixture snack",
  "Haldiram's Soan Papdi": "soan papdi indian sweet",
  "Kwality Wall's Cornetto Butterscotch": "ice cream cone butterscotch",
  "MTR Ready to Eat Rajma Masala": "rajma masala curry",
  "Nature Fresh Soyabean Oil": "soybean oil bottle",
  "Paper Boat Aam Panna": "mango drink aam panna",
  "Uncle Chipps Spicy Treat": "spicy potato chips",
};

// Categories to target
const TARGET_CATEGORIES = [
  "Milk", "Bread", "Butter & Ghee", "Tea & Coffee", "Eggs",
  "Chips & Crisps", "Biscuits", "Juices", "Ready to Eat",
  "Vegetables", "Cooking Oil", "Meat", "Fruits", "Ice Cream",
  "Chocolates", "Namkeen", "Frozen Food", "Chocolates & Sweets",
];

/**
 * Simplify product name by removing brand names and keeping the descriptive part.
 * Uses word-boundary-aware matching to avoid truncating words.
 */
function simplifyQuery(productName: string): string {
  // Check manual overrides first
  if (MANUAL_QUERY_MAP[productName]) {
    return MANUAL_QUERY_MAP[productName];
  }

  let query = productName;

  // Sort brand names by length (longest first) to avoid partial matches
  const sortedBrands = [...BRAND_NAMES].sort((a, b) => b.length - a.length);

  for (const brand of sortedBrands) {
    // Use word-boundary-aware regex to avoid cutting into other words
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    query = query.replace(regex, "");
  }

  // Clean up extra spaces, leading/trailing whitespace
  query = query.replace(/\s+/g, " ").trim();

  // Remove leading special characters like "'s" leftover
  query = query.replace(/^['s]+\s*/i, "").trim();

  // If result is too short, use original product name
  if (query.length < 3) {
    return productName;
  }

  return query;
}

/**
 * Fetch an image URL from Unsplash's internal API.
 */
async function fetchUnsplashUrl(query: string): Promise<string | null> {
  try {
    const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=1`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      console.log(`    HTTP ${res.status} for query: "${query}"`);
      return null;
    }

    const data = (await res.json()) as any;
    if (data.results && data.results.length > 0) {
      return data.results[0].urls?.regular || null;
    }
    return null;
  } catch (err) {
    console.log(`    Error fetching for query "${query}":`, err);
    return null;
  }
}

async function main() {
  // Find all products without images in target categories
  const products = await prisma.product.findMany({
    where: {
      OR: [{ imageUrl: null }, { imageUrl: "" }],
      category: {
        name: { in: TARGET_CATEGORIES },
      },
    },
    include: { category: true },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${products.length} products without images\n`);

  if (products.length === 0) {
    console.log("Nothing to do!");
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const product of products) {
    const searchQuery = simplifyQuery(product.name);
    console.log(
      `[${updated + failed + 1}/${products.length}] ${product.name} -> "${searchQuery}"`
    );

    const imageUrl = await fetchUnsplashUrl(searchQuery);

    if (imageUrl) {
      const finalUrl = `${imageUrl}?w=400&h=400&fit=crop`;
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: finalUrl },
      });
      updated++;
      console.log(`  [OK] Updated`);
    } else {
      failed++;
      console.log(`  [FAIL] No image found`);
    }

    // Delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n--- Done ---`);
  console.log(`Updated: ${updated}, Failed: ${failed}, Total: ${products.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
