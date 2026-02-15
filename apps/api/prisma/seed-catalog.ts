import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient, UnitType, FoodType, ProductType } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const PROMPT = `Generate a JSON array of 350+ common Indian supermarket products (grocery + FMCG) organized by category.

Return ONLY valid JSON (no markdown, no explanation). The JSON should be an array of objects with this exact structure:

[
  {
    "categoryPath": "Food > Dairy",
    "name": "Amul Toned Milk",
    "brand": "Amul",
    "description": "Fresh toned milk",
    "productType": "DAIRY",
    "hsnCode": "0401",
    "gstPercent": 5,
    "foodType": "VEG",
    "fssaiLicense": "10014011000123",
    "regulatoryMarks": ["FSSAI", "AGMARK"],
    "certifications": [],
    "mfgLicenseNo": null,
    "dangerWarnings": null,
    "usageInstructions": null,
    "ingredients": "Toned milk, pasteurized",
    "nutritionalInfo": {"energy":"60kcal","protein":"3g","fat":"3g","carbs":"5g"},
    "allergens": ["Milk"],
    "servingSize": "200ml",
    "shelfLifeDays": 5,
    "storageInstructions": "Keep refrigerated below 4°C",
    "manufacturerName": "Gujarat Cooperative Milk Marketing Federation Ltd",
    "countryOfOrigin": "India",
    "tags": ["dairy", "fresh"],
    "variants": [
      { "name": "500ml", "sku": "DAIRY-AMUL-MILK-500ML", "barcode": "8901030793424", "unitType": "ML", "unitValue": 500, "mrp": 28.00, "packType": "pouch" },
      { "name": "1 Liter", "sku": "DAIRY-AMUL-MILK-1L", "barcode": "8901030793431", "unitType": "LITER", "unitValue": 1, "mrp": 54.00, "packType": "pouch" }
    ]
  }
]

Rules:
- categoryPath uses " > " separator for nesting (e.g. "Food > Dairy", "Food > Grains > Rice")
- productType must be one of: GROCERY, SNACKS, BEVERAGES, DAIRY, FROZEN, FRESH_PRODUCE, BAKERY, PERSONAL_CARE, HOUSEHOLD, BABY_CARE, PET_CARE, OTC_PHARMA
- unitType must be one of: KG, GRAM, LITER, ML, PIECE, PACK, DOZEN, BUNDLE
- SKU must be unique across all products/variants
- barcode should be a realistic 13-digit EAN-13 barcode, unique per variant
- mrp is the Maximum Retail Price in INR printed on the pack
- brand is the manufacturer/brand name
- hsnCode is the HSN/SAC code used for Indian GST (e.g. "0401" for milk, "1006" for rice)
- gstPercent is the GST tax rate: 0, 5, 12, 18, or 28
- foodType must be one of: VEG, NON_VEG, VEGAN, EGG (mandatory for food items, omit for non-food items like household/personal care)
- fssaiLicense is a 14-digit FSSAI license number (use realistic-looking numbers, only for food items)
- regulatoryMarks is an array from: FSSAI, ISI, AGMARK, BIS, ORGANIC_INDIA, HALAL, KOSHER, ECOMARK, FPO. Use FSSAI for food, ISI/BIS for household/personal care. Use empty array [] if none
- certifications is an array like: Organic, Cruelty-Free, ISO 22000, GMP, HACCP, Dermatologically Tested, Vegan Certified. Use empty array [] if none
- mfgLicenseNo is a manufacturing license number (for non-food items; null for food)
- dangerWarnings is a safety warning string for chemicals, insecticides, OTC drugs (e.g. "Keep away from children", "For external use only"). Use null if not applicable
- usageInstructions is how to use the product (important for personal care, household, OTC). Use null if not applicable
- ingredients is the ingredient list as printed on the pack
- nutritionalInfo is a JSON object with energy, protein, fat, carbs, fiber etc. (per serving). Use null for non-food items
- allergens is an array of allergen declarations (e.g. ["Gluten", "Milk", "Nuts"]). Use empty array [] if none
- servingSize is the serving size (e.g. "30g", "1 cup (250ml)")
- shelfLifeDays is the shelf life in days
- storageInstructions is the storage instruction (e.g. "Store in a cool, dry place")
- manufacturerName is the manufacturer or brand owner company name
- countryOfOrigin is the country of origin (usually "India")
- packType on variants is the packaging form: pouch, box, bottle, jar, tin, sachet, can, bag, tube, etc.
- tags are useful filtering labels like "organic", "vegan", "sugar-free", "gluten-free", "fresh", "frozen"
- Each product must have at least 1 variant, many should have 2-3 size variants
- Cover these categories with FMCG depth:
  Food: Dairy, Grains & Cereals, Cooking Oil, Spices & Masala, Snacks, Beverages, Frozen Food, Bakery, Fruits, Vegetables, Pulses & Lentils, Dry Fruits & Nuts, Canned & Packaged, Sauces & Condiments
  Personal Care: Face Wash, Shampoo, Toothpaste, Soap, Deodorant, Skincare, Haircare, Oral Care
  Household: Floor Cleaner, Detergent, Insect Repellent, Kitchen Supplies, Dishwash
  Baby Care: Diapers, Baby Food, Baby Skincare
  OTC Pharma: Pain Relief, Cold & Cough, Digestive, Antiseptic
  Pet Care: Pet Food, Pet Hygiene
- Use real Indian brand names: Amul, Tata, MDH, Haldiram's, Parle, Britannia, Dabur, Dettol, Lifebuoy, Colgate, Head & Shoulders, Dove, Nivea, Surf Excel, Harpic, Vim, Good Knight, Pampers, Vicks, Crocin, Moov, Lay's, Kurkure, Maggi, Nescafe, Pepsi, Bisleri, Pedigree, Whiskas, Himalaya, Mamaearth, Johnson's Baby, Cerelac, etc.
- Generate at least 350 products total with realistic variants`;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("Starting catalog seed...");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  console.log("Calling Claude API to generate catalog...");
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 32000,
    messages: [{ role: "user", content: PROMPT }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const products: Array<{
    categoryPath: string;
    name: string;
    brand?: string;
    description: string;
    productType?: string;
    hsnCode?: string;
    gstPercent?: number;
    foodType?: string;
    fssaiLicense?: string;
    regulatoryMarks?: string[];
    certifications?: string[];
    mfgLicenseNo?: string | null;
    dangerWarnings?: string | null;
    usageInstructions?: string | null;
    ingredients?: string;
    nutritionalInfo?: Record<string, string>;
    allergens?: string[];
    servingSize?: string;
    shelfLifeDays?: number;
    storageInstructions?: string;
    manufacturerName?: string;
    countryOfOrigin?: string;
    tags?: string[];
    variants: Array<{
      name: string;
      sku: string;
      barcode?: string;
      unitType: string;
      unitValue: number;
      mrp?: number;
      packType?: string;
    }>;
  }> = JSON.parse(textBlock.text);

  console.log(`Received ${products.length} products from Claude`);

  // Step 1: Extract and create categories
  const categoryPaths = new Set<string>();
  for (const p of products) {
    const parts = p.categoryPath.split(" > ");
    for (let i = 1; i <= parts.length; i++) {
      categoryPaths.add(parts.slice(0, i).join(" > "));
    }
  }

  const sortedPaths = Array.from(categoryPaths).sort();
  const categoryMap = new Map<string, string>(); // path -> id

  console.log(`Creating ${sortedPaths.length} categories...`);
  for (const path of sortedPaths) {
    const parts = path.split(" > ");
    const name = parts[parts.length - 1];
    const slug = slugify(path.replace(/ > /g, "-"));
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join(" > ") : null;
    const parentId = parentPath ? categoryMap.get(parentPath) ?? null : null;

    const category = await prisma.category.upsert({
      where: { slug },
      update: { name, parentId },
      create: { name, slug, parentId, sortOrder: 0 },
    });
    categoryMap.set(path, category.id);
  }

  // Step 2: Create products and variants
  let productCount = 0;
  let variantCount = 0;

  console.log("Creating products and variants...");
  for (const p of products) {
    const categoryId = categoryMap.get(p.categoryPath) ?? null;

    // Check if product already exists (by first variant SKU)
    const firstSku = p.variants[0]?.sku;
    if (firstSku) {
      const existing = await prisma.productVariant.findUnique({ where: { sku: firstSku } });
      if (existing) {
        continue; // Already seeded
      }
    }

    const validUnitTypes = Object.values(UnitType);
    const validFoodTypes = Object.values(FoodType);
    const validProductTypes = Object.values(ProductType);
    const product = await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        brand: p.brand ?? null,
        hsnCode: p.hsnCode ?? null,
        gstPercent: p.gstPercent ?? null,
        foodType: p.foodType && validFoodTypes.includes(p.foodType as FoodType) ? (p.foodType as FoodType) : null,
        productType: p.productType && validProductTypes.includes(p.productType as ProductType) ? (p.productType as ProductType) : null,
        fssaiLicense: p.fssaiLicense ?? null,
        regulatoryMarks: p.regulatoryMarks ?? [],
        certifications: p.certifications ?? [],
        mfgLicenseNo: p.mfgLicenseNo ?? null,
        dangerWarnings: p.dangerWarnings ?? null,
        usageInstructions: p.usageInstructions ?? null,
        ingredients: p.ingredients ?? null,
        nutritionalInfo: p.nutritionalInfo ?? undefined,
        allergens: p.allergens ?? [],
        servingSize: p.servingSize ?? null,
        shelfLifeDays: p.shelfLifeDays ?? null,
        storageInstructions: p.storageInstructions ?? null,
        manufacturerName: p.manufacturerName ?? null,
        countryOfOrigin: p.countryOfOrigin ?? null,
        tags: p.tags ?? [],
        categoryId,
        variants: {
          create: p.variants.map((v) => ({
            name: v.name,
            sku: v.sku,
            barcode: v.barcode ?? null,
            unitType: validUnitTypes.includes(v.unitType as UnitType) ? (v.unitType as UnitType) : "PIECE",
            unitValue: v.unitValue,
            mrp: v.mrp ?? null,
            packType: v.packType ?? null,
          })),
        },
      },
    });

    productCount++;
    variantCount += p.variants.length;

    if (productCount % 50 === 0) {
      console.log(`  Created ${productCount} products...`);
    }
  }

  console.log(`\nDone! Created ${productCount} products with ${variantCount} variants in ${sortedPaths.length} categories.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
