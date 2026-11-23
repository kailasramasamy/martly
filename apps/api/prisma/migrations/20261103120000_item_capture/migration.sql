CREATE TYPE "CatalogDraftKind" AS ENUM ('PACK', 'ITEM');
CREATE TYPE "ItemShape" AS ENUM ('ROUND', 'BOX', 'FLAT');

ALTER TABLE "catalog_drafts"
  ADD COLUMN "kind" "CatalogDraftKind" NOT NULL DEFAULT 'PACK',
  ADD COLUMN "measurement" JSONB;

ALTER TABLE "product_variants"
  ADD COLUMN "shape" "ItemShape",
  ADD COLUMN "length_mm" INTEGER,
  ADD COLUMN "width_mm" INTEGER,
  ADD COLUMN "height_mm" INTEGER,
  ADD COLUMN "top_diameter_mm" INTEGER,
  ADD COLUMN "base_diameter_mm" INTEGER,
  ADD COLUMN "capacity_ml" INTEGER,
  ADD COLUMN "capacity_is_estimate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sketch_url" TEXT;
