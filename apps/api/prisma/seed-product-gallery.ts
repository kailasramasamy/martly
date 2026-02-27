import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

async function fetchUnsplashUrls(query: string, count: number): Promise<string[]> {
  const encoded = encodeURIComponent(query);
  try {
    const res = await fetch(
      `https://unsplash.com/napi/search/photos?query=${encoded}&per_page=${count + 3}`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const results = data.results || [];

    const urls: string[] = [];
    for (const r of results) {
      const raw: string = r.urls?.raw || "";
      const freeMatch = raw.match(/(https:\/\/images\.unsplash\.com\/photo-[^?]+)/);
      if (freeMatch) {
        urls.push(freeMatch[1]);
        if (urls.length >= count) break;
      }
    }
    // Fallback: accept any URL
    if (urls.length < count) {
      for (const r of results) {
        const raw: string = r.urls?.raw || "";
        const anyMatch = raw.match(/(https:\/\/[^?]+)/);
        if (anyMatch && !urls.includes(anyMatch[1])) {
          urls.push(anyMatch[1]);
          if (urls.length >= count) break;
        }
      }
    }
    return urls;
  } catch {
    return [];
  }
}

// Map product name substrings to broader gallery search terms
const GALLERY_QUERIES: Record<string, string[]> = {
  // Fruits
  "Mango": ["mango fruit close up", "mango slice", "mango tree fruit"],
  "Kiwi": ["kiwi fruit sliced", "green kiwi", "kiwi halves"],
  "Orange": ["fresh oranges", "orange fruit pile", "orange slices"],
  "Banana": ["banana bunch", "ripe bananas", "banana fruit"],
  // Vegetables
  "Spinach": ["spinach leaves fresh", "spinach bunch", "green leafy vegetable"],
  "Carrot": ["fresh carrots", "carrot bunch", "orange carrots"],
  "Onion": ["onion pile", "red onion", "onion slices"],
  // Dairy
  "Milk": ["milk pouring glass", "milk bottle", "dairy milk"],
  "Curd": ["yogurt bowl", "fresh curd", "dairy yogurt"],
  "Paneer": ["paneer cubes", "cottage cheese", "paneer dish"],
  "Butter": ["butter block", "butter sliced", "yellow butter"],
  // Grains
  "Basmati": ["basmati rice grain", "rice bowl", "rice closeup"],
  "Atta": ["wheat flour", "flour powder", "wheat grain"],
  // Oil
  "Sunflower": ["sunflower oil bottle", "cooking oil", "vegetable oil"],
  "Olive": ["olive oil bottle", "olive oil pouring", "extra virgin olive oil"],
  "Coconut Oil": ["coconut oil jar", "virgin coconut oil", "coconut"],
  // Snacks
  "Chips": ["potato chips", "crispy chips", "snack chips bowl"],
  "Biscuit": ["biscuit stack", "cookies plate", "tea biscuits"],
  "Noodles": ["instant noodles", "noodles bowl", "ramen noodles"],
  // Beverages
  "Juice": ["fresh juice glass", "fruit juice", "juice bottle"],
  "Water": ["water bottle", "mineral water", "drinking water"],
  "Coffee": ["coffee beans", "coffee cup", "instant coffee"],
  "Tea": ["tea leaves", "cup of tea", "tea pot"],
  // Chocolate
  "Chocolate": ["chocolate bar", "dark chocolate", "chocolate pieces"],
  // Personal Care
  "Face Wash": ["face wash", "facial cleanser", "skincare product"],
  "Shampoo": ["shampoo bottle", "hair shampoo", "hair care product"],
  "Soap": ["bar soap", "soap bubbles", "bath soap"],
  "Toothpaste": ["toothpaste tube", "dental care", "oral hygiene"],
  // Household
  "Detergent": ["washing detergent", "laundry powder", "cleaning product"],
  "Dishwash": ["dish soap", "dishwashing liquid", "clean dishes"],
  // Baby
  "Diaper": ["baby diaper", "diaper pack", "baby care"],
  "Baby": ["baby products", "baby care", "infant care"],
};

function getSearchQueries(productName: string): string[] {
  for (const [key, queries] of Object.entries(GALLERY_QUERIES)) {
    if (productName.toLowerCase().includes(key.toLowerCase())) {
      return queries;
    }
  }
  // Fallback: use product name with different angles
  return [
    `${productName} product`,
    `${productName} closeup`,
    `${productName} detail`,
  ];
}

async function main() {
  // Find products that have a primary image but empty gallery
  const products = await prisma.product.findMany({
    where: {
      imageUrl: { not: null },
      images: { isEmpty: true },
    },
    select: { id: true, name: true, imageUrl: true },
    take: 50,
  });

  console.log(`Found ${products.length} products with primary image but no gallery images`);

  let updated = 0;
  let failed = 0;

  for (const product of products) {
    const queries = getSearchQueries(product.name);
    const galleryImages: string[] = [];

    // Fetch images from multiple queries to get variety
    for (const query of queries) {
      if (galleryImages.length >= 3) break;
      const urls = await fetchUnsplashUrls(query, 2);
      for (const url of urls) {
        // Skip if same as primary image (strip query params for comparison)
        const primaryBase = product.imageUrl?.split("?")[0] ?? "";
        if (url === primaryBase) continue;
        if (!galleryImages.includes(url)) {
          galleryImages.push(url);
          if (galleryImages.length >= 4) break;
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (galleryImages.length > 0) {
      const formatted = galleryImages.map((url) => `${url}?w=600&h=600&fit=crop`);
      await prisma.product.update({
        where: { id: product.id },
        data: { images: formatted },
      });
      updated++;
      console.log(`  [ok] ${product.name} — ${formatted.length} gallery images`);
    } else {
      failed++;
      console.log(`  [FAIL] ${product.name}`);
    }
  }

  console.log(`\n--- Done ---`);
  console.log(`Updated: ${updated}, Failed: ${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
