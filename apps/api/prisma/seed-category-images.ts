import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

// Better search terms for grocery subcategories
const SEARCH_OVERRIDES: Record<string, string> = {
  // Dairy & Eggs
  "Milk": "milk bottle white background",
  "Curd & Yogurt": "yogurt cup white background",
  "Butter & Ghee": "butter block white background",
  "Cheese": "cheese slices white background",
  "Paneer & Tofu": "paneer cubes white background",
  "Eggs": "eggs carton white background",
  "Cream & Condensed Milk": "cream bottle white background",

  // Fruits & Vegetables
  "Fresh Fruits": "fresh fruits assorted white background",
  "Fresh Vegetables": "fresh vegetables assorted white background",
  "Exotic Fruits": "dragon fruit kiwi white background",
  "Exotic Vegetables": "asparagus zucchini white background",
  "Herbs & Seasonings": "fresh herbs basil white background",
  "Organic Fruits": "organic apple fruit white background",
  "Organic Vegetables": "organic vegetables white background",
  "Cuts & Sprouts": "bean sprouts white background",

  // Bakery
  "Bread & Buns": "bread loaf white background",
  "Cookies & Biscuits": "cookies assorted white background",
  "Cakes & Pastries": "pastry cake white background",
  "Rusks & Toasts": "rusk toast white background",
  "Pav & Kulcha": "pav bread white background",

  // Beverages
  "Tea": "tea box white background",
  "Coffee": "coffee beans bag white background",
  "Juices": "juice bottle white background",
  "Soft Drinks": "soda can white background",
  "Health Drinks": "health drink protein white background",
  "Water": "water bottle white background",
  "Energy Drinks": "energy drink can white background",

  // Snacks
  "Chips & Crisps": "potato chips bag white background",
  "Namkeen & Mixtures": "indian namkeen snack white background",
  "Biscuits": "biscuit packet white background",
  "Chocolates & Sweets": "chocolate bar white background",
  "Dry Fruits & Nuts": "almonds cashew nuts white background",
  "Instant Noodles": "instant noodles packet white background",
  "Popcorn & Puffs": "popcorn white background",

  // Grains & Cereals
  "Rice": "rice grain bag white background",
  "Atta & Flour": "wheat flour atta white background",
  "Dal & Pulses": "dal lentils white background",
  "Cereals & Muesli": "muesli cereal box white background",
  "Oats": "oats bowl white background",

  // Cooking Essentials
  "Cooking Oil": "cooking oil bottle white background",
  "Spices & Masala": "spices masala white background",
  "Salt & Sugar": "salt sugar white background",
  "Vinegar & Sauces": "soy sauce bottle white background",
  "Pickles & Chutneys": "pickle jar white background",
  "Ready to Cook": "ready to cook meal white background",
  "Ghee": "ghee jar white background",

  // Frozen Food
  "Frozen Vegetables": "frozen vegetables bag white background",
  "Frozen Snacks": "frozen samosa white background",
  "Ice Cream": "ice cream tub white background",
  "Frozen Meat": "frozen meat pack white background",
  "Frozen Desserts": "frozen dessert white background",

  // Personal Care
  "Skin Care": "skincare products white background",
  "Hair Care": "shampoo bottle white background",
  "Oral Care": "toothpaste toothbrush white background",
  "Bath & Body": "soap body wash white background",
  "Deodorants": "deodorant spray white background",
  "Men's Grooming": "mens grooming kit white background",
  "Feminine Hygiene": "hygiene products white background",

  // Household
  "Cleaning Supplies": "cleaning spray bottle white background",
  "Detergents": "detergent powder white background",
  "Dishwash": "dishwash liquid white background",
  "Fresheners": "air freshener white background",
  "Pest Control": "pest control spray white background",
  "Garbage Bags": "garbage bag roll white background",
  "Kitchen Accessories": "kitchen accessories white background",

  // Baby Care
  "Diapers": "baby diapers pack white background",
  "Baby Food": "baby food jar white background",
  "Baby Skin Care": "baby lotion white background",
  "Baby Bath": "baby shampoo white background",
  "Baby Accessories": "baby bottle white background",

  // Meat & Seafood
  "Chicken": "raw chicken white background",
  "Mutton": "raw mutton meat white background",
  "Fish & Seafood": "fresh fish white background",
  "Eggs & Poultry": "eggs poultry white background",

  // Pet Care
  "Dog Food": "dog food bag white background",
  "Cat Food": "cat food bag white background",
  "Pet Accessories": "pet accessories white background",

  // Parent categories (also seed if missing)
  "Dairy & Eggs": "dairy products milk eggs white background",
  "Fruits & Vegetables": "fruits vegetables fresh white background",
  "Bakery": "bakery bread assorted white background",
  "Beverages": "beverages drinks assorted white background",
  "Snacks": "snacks chips assorted white background",
  "Grains & Cereals": "grains rice flour white background",
  "Cooking Essentials": "cooking oil spices white background",
  "Frozen Food": "frozen food assorted white background",
  "Personal Care": "personal care products white background",
  "Household": "household cleaning products white background",
  "Baby Care": "baby care products white background",
  "Meat & Seafood": "meat seafood fresh white background",
  "Pet Care": "pet food accessories white background",
  "Ready to Eat": "ready to eat meal white background",
  "Dry Fruits": "dry fruits nuts white background",
};

async function searchUnsplash(query: string): Promise<string | null> {
  try {
    const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=5`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results?.length) return null;
    // Pick first result
    const photo = data.results[0];
    return photo.urls?.raw
      ? `${photo.urls.raw}&w=400&h=400&fit=crop&crop=entropy`
      : null;
  } catch {
    return null;
  }
}

async function main() {
  const categories = await prisma.category.findMany({
    where: { imageUrl: null },
    select: { id: true, name: true, parentId: true },
    orderBy: { sortOrder: "asc" },
  });

  console.log(`Found ${categories.length} categories without images`);

  let updated = 0;
  let failed = 0;

  for (const cat of categories) {
    const searchTerm = SEARCH_OVERRIDES[cat.name] || `${cat.name} grocery white background`;
    console.log(`  Searching: "${cat.name}" -> "${searchTerm}"`);

    const imageUrl = await searchUnsplash(searchTerm);
    if (imageUrl) {
      await prisma.category.update({
        where: { id: cat.id },
        data: { imageUrl },
      });
      updated++;
      console.log(`    ✓ Updated`);
    } else {
      failed++;
      console.log(`    ✗ No image found`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n--- Done ---`);
  console.log(`Updated: ${updated}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main();
