-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('KG', 'GRAM', 'LITER', 'ML', 'PIECE', 'PACK', 'DOZEN', 'BUNDLE');

-- CreateTable: categories
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: product_variants
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit_type" "UnitType" NOT NULL DEFAULT 'PIECE',
    "unit_value" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add category_id to products
ALTER TABLE "products" ADD COLUMN "category_id" TEXT;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- For each existing product, create a default variant (copy sku over)
INSERT INTO "product_variants" ("id", "product_id", "name", "sku", "unit_type", "unit_value", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    "id",
    'Default',
    "sku",
    'PIECE'::"UnitType",
    1,
    NOW(),
    NOW()
FROM "products";

-- Add variant_id to store_products (nullable first)
ALTER TABLE "store_products" ADD COLUMN "variant_id" TEXT;

-- Backfill variant_id on store_products using product -> default variant lookup
UPDATE "store_products" sp
SET "variant_id" = pv."id"
FROM "product_variants" pv
WHERE pv."product_id" = sp."product_id";

-- Make variant_id NOT NULL
ALTER TABLE "store_products" ALTER COLUMN "variant_id" SET NOT NULL;

-- Add FK constraint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old unique index and add new one
DROP INDEX "store_products_store_id_product_id_key";
CREATE UNIQUE INDEX "store_products_store_id_variant_id_key" ON "store_products"("store_id", "variant_id");

-- Add variant_id to order_items (nullable first)
ALTER TABLE "order_items" ADD COLUMN "variant_id" TEXT;

-- Backfill variant_id on order_items using product -> default variant lookup
UPDATE "order_items" oi
SET "variant_id" = pv."id"
FROM "product_variants" pv
WHERE pv."product_id" = oi."product_id";

-- Make variant_id NOT NULL
ALTER TABLE "order_items" ALTER COLUMN "variant_id" SET NOT NULL;

-- Add FK constraint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop sku from products
ALTER TABLE "products" DROP COLUMN "sku";
