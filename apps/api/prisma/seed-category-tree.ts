/**
 * Seed a new root category "Cleaning & Laundry" with full hierarchy:
 * - 3 children
 * - 2 grandchildren each (6 total)
 * - 4 products per grandchild (24 total)
 * All products mapped to Bigmart store with pricing and stock.
 */
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

interface ProductDef {
  name: string;
  sku: string;
  description: string;
  price: number;
  mrp: number;
  unit: string;
  unitValue: number;
  unitType: string;
}

interface GrandChild {
  name: string;
  slug: string;
  products: ProductDef[];
}

interface Child {
  name: string;
  slug: string;
  grandChildren: GrandChild[];
}

const CATEGORY_TREE: { root: { name: string; slug: string }; children: Child[] } = {
  root: { name: "Cleaning & Laundry", slug: "cleaning-laundry" },
  children: [
    {
      name: "Detergents",
      slug: "cleaning-detergents",
      grandChildren: [
        {
          name: "Liquid Detergent",
          slug: "cleaning-liquid-detergent",
          products: [
            { name: "Surf Excel Matic Liquid Front Load", sku: "surf-excel-matic-liquid-fl", description: "Top-load liquid detergent for tough stain removal", price: 299, mrp: 349, unit: "1 L", unitValue: 1, unitType: "L" },
            { name: "Ariel Matic Liquid Top Load", sku: "ariel-matic-liquid-tl", description: "Ariel liquid detergent for top-load machines", price: 275, mrp: 320, unit: "1 L", unitValue: 1, unitType: "L" },
            { name: "Comfort After Wash Fabric Conditioner", sku: "comfort-fabric-conditioner", description: "Morning Fresh fabric conditioner for soft clothes", price: 189, mrp: 210, unit: "860 ml", unitValue: 860, unitType: "ml" },
            { name: "Persil Liquid Detergent", sku: "persil-liquid-detergent", description: "Premium liquid detergent with deep clean technology", price: 399, mrp: 450, unit: "1 L", unitValue: 1, unitType: "L" },
          ],
        },
        {
          name: "Powder Detergent",
          slug: "cleaning-powder-detergent",
          products: [
            { name: "Surf Excel Easy Wash Powder", sku: "surf-excel-easy-wash-powder", description: "Easy wash detergent powder for hand wash", price: 145, mrp: 165, unit: "1 kg", unitValue: 1, unitType: "kg" },
            { name: "Tide Plus Double Power", sku: "tide-plus-double-power", description: "Tide detergent with lemon and mint", price: 135, mrp: 155, unit: "1 kg", unitValue: 1, unitType: "kg" },
            { name: "Rin Advanced Powder", sku: "rin-advanced-powder", description: "Rin detergent powder for bright white clothes", price: 99, mrp: 115, unit: "1 kg", unitValue: 1, unitType: "kg" },
            { name: "Nirma Washing Powder", sku: "nirma-washing-powder", description: "Nirma super detergent powder", price: 65, mrp: 75, unit: "1 kg", unitValue: 1, unitType: "kg" },
          ],
        },
      ],
    },
    {
      name: "Surface Cleaners",
      slug: "cleaning-surface-cleaners",
      grandChildren: [
        {
          name: "Floor Cleaners",
          slug: "cleaning-floor-cleaners",
          products: [
            { name: "Lizol Disinfectant Floor Cleaner Citrus", sku: "lizol-floor-cleaner-citrus", description: "Lizol citrus floor cleaner that kills 99.9% germs", price: 199, mrp: 225, unit: "975 ml", unitValue: 975, unitType: "ml" },
            { name: "Harpic Disinfectant Floor Cleaner", sku: "harpic-floor-cleaner", description: "Harpic floor cleaner with floral fragrance", price: 179, mrp: 199, unit: "1 L", unitValue: 1, unitType: "L" },
            { name: "Presto Floor Cleaner Pine", sku: "presto-floor-cleaner-pine", description: "Pine-scented floor cleaner for fresh surfaces", price: 149, mrp: 175, unit: "975 ml", unitValue: 975, unitType: "ml" },
            { name: "Domex Floor Cleaner Lemon", sku: "domex-floor-cleaner-lemon", description: "Kills all germs with lemon fresh fragrance", price: 165, mrp: 189, unit: "1 L", unitValue: 1, unitType: "L" },
          ],
        },
        {
          name: "Kitchen Cleaners",
          slug: "cleaning-kitchen-cleaners",
          products: [
            { name: "Vim Dishwash Liquid Gel Lemon", sku: "vim-dishwash-gel-lemon", description: "Vim liquid gel for sparkling clean dishes", price: 125, mrp: 145, unit: "500 ml", unitValue: 500, unitType: "ml" },
            { name: "Pril Dishwash Liquid Lime", sku: "pril-dishwash-lime", description: "Pril dish wash liquid with lime fragrance", price: 119, mrp: 135, unit: "500 ml", unitValue: 500, unitType: "ml" },
            { name: "Scotch-Brite Scrub Sponge Pack", sku: "scotch-brite-sponge-pack", description: "Pack of 3 antibacterial scrub sponges", price: 89, mrp: 99, unit: "3 pcs", unitValue: 3, unitType: "pcs" },
            { name: "Vim Dishwash Bar", sku: "vim-dishwash-bar", description: "Vim dish wash bar for tough grease removal", price: 35, mrp: 40, unit: "200 g", unitValue: 200, unitType: "g" },
          ],
        },
      ],
    },
    {
      name: "Toilet & Bathroom",
      slug: "cleaning-toilet-bathroom",
      grandChildren: [
        {
          name: "Toilet Cleaners",
          slug: "cleaning-toilet-cleaners",
          products: [
            { name: "Harpic Power Plus Original", sku: "harpic-power-plus-original", description: "Harpic toilet cleaner with 10x better cleaning", price: 109, mrp: 125, unit: "500 ml", unitValue: 500, unitType: "ml" },
            { name: "Domex Fresh Guard Toilet Cleaner", sku: "domex-fresh-guard", description: "Domex thick toilet cleaner with ocean fresh scent", price: 95, mrp: 110, unit: "500 ml", unitValue: 500, unitType: "ml" },
            { name: "Harpic Flushmatic Aquamarine", sku: "harpic-flushmatic", description: "In-cistern toilet cleaner block", price: 85, mrp: 99, unit: "50 g", unitValue: 50, unitType: "g" },
            { name: "Sanifresh Ultrashine Toilet Cleaner", sku: "sanifresh-ultrashine", description: "Sanifresh toilet cleaner for sparkling clean toilets", price: 79, mrp: 90, unit: "500 ml", unitValue: 500, unitType: "ml" },
          ],
        },
        {
          name: "Bathroom Accessories",
          slug: "cleaning-bathroom-accessories",
          products: [
            { name: "Scotch-Brite Bathroom Brush", sku: "scotch-brite-bathroom-brush", description: "Heavy duty bathroom scrubbing brush", price: 149, mrp: 175, unit: "1 pc", unitValue: 1, unitType: "pcs" },
            { name: "Colin Glass Cleaner Spray", sku: "colin-glass-cleaner", description: "Colin glass and surface cleaner spray", price: 135, mrp: 155, unit: "500 ml", unitValue: 500, unitType: "ml" },
            { name: "Odonil Room Freshener Block", sku: "odonil-room-freshener", description: "Odonil bathroom air freshener block", price: 55, mrp: 65, unit: "75 g", unitValue: 75, unitType: "g" },
            { name: "Pee Safe Toilet Seat Sanitizer", sku: "pee-safe-toilet-sanitizer", description: "Toilet seat sanitizer spray for hygiene", price: 199, mrp: 225, unit: "75 ml", unitValue: 75, unitType: "ml" },
          ],
        },
      ],
    },
  ],
};

async function main() {
  const store = await prisma.store.findFirst({
    where: { slug: "bigmart" },
    select: { id: true, organizationId: true },
  });
  const targetStore = store ?? await prisma.store.findFirstOrThrow({ select: { id: true, organizationId: true } });
  console.log(`Using store: ${targetStore.id}`);

  // Clean up if root category already exists (from a failed previous run)
  const existing = await prisma.category.findUnique({ where: { slug: CATEGORY_TREE.root.slug } });
  if (existing) {
    console.log(`"${CATEGORY_TREE.root.name}" already exists - cleaning up first...`);
    const children = await prisma.category.findMany({ where: { parentId: existing.id } });
    for (const child of children) {
      // Delete products in grandchildren
      const grandChildren = await prisma.category.findMany({ where: { parentId: child.id } });
      for (const gc of grandChildren) {
        const products = await prisma.product.findMany({ where: { categoryId: gc.id }, select: { id: true } });
        for (const p of products) {
          await prisma.storeProduct.deleteMany({ where: { productId: p.id } });
          await prisma.productVariant.deleteMany({ where: { productId: p.id } });
        }
        await prisma.product.deleteMany({ where: { categoryId: gc.id } });
      }
      await prisma.category.deleteMany({ where: { parentId: child.id } });
    }
    await prisma.category.deleteMany({ where: { parentId: existing.id } });
    await prisma.category.delete({ where: { id: existing.id } });
    console.log("Cleaned up previous data");
  }

  // Create root category
  const root = await prisma.category.create({
    data: {
      name: CATEGORY_TREE.root.name,
      slug: CATEGORY_TREE.root.slug,
      sortOrder: 7,
    },
  });
  console.log(`Created root: ${root.name}`);

  let totalProducts = 0;

  for (let ci = 0; ci < CATEGORY_TREE.children.length; ci++) {
    const childDef = CATEGORY_TREE.children[ci];

    const child = await prisma.category.create({
      data: {
        name: childDef.name,
        slug: childDef.slug,
        parentId: root.id,
        sortOrder: ci,
      },
    });
    console.log(`  Created child: ${child.name}`);

    for (let gi = 0; gi < childDef.grandChildren.length; gi++) {
      const gcDef = childDef.grandChildren[gi];

      const grandChild = await prisma.category.create({
        data: {
          name: gcDef.name,
          slug: gcDef.slug,
          parentId: child.id,
          sortOrder: gi,
        },
      });
      console.log(`    Created grandchild: ${grandChild.name}`);

      for (const prodDef of gcDef.products) {
        const UNIT_MAP: Record<string, string> = {
          "L": "LITER", "ml": "ML", "kg": "KG", "g": "GRAM", "pcs": "PIECE",
        };
        const prismaUnitType = UNIT_MAP[prodDef.unitType] ?? "PIECE";

        const product = await prisma.product.create({
          data: {
            name: prodDef.name,
            description: prodDef.description,
            categoryId: grandChild.id,
            organizationId: targetStore.organizationId,
            isActive: true,
            productType: "HOUSEHOLD",
          },
        });

        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            name: prodDef.unit,
            sku: prodDef.sku,
            unitValue: prodDef.unitValue,
            unitType: prismaUnitType as any,
            mrp: prodDef.mrp,
          },
        });

        await prisma.storeProduct.create({
          data: {
            storeId: targetStore.id,
            productId: product.id,
            variantId: variant.id,
            price: prodDef.price,
            stock: 20 + Math.floor(Math.random() * 80),
            reservedStock: 0,
            isActive: true,
            isFeatured: false,
          },
        });

        totalProducts++;
        console.log(`      + ${prodDef.name} (Rs.${prodDef.price})`);
      }
    }
  }

  console.log(`\nDone! Created 1 root -> 3 children -> 6 grandchildren -> ${totalProducts} products`);
  console.log("All products mapped to store with pricing and stock.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
