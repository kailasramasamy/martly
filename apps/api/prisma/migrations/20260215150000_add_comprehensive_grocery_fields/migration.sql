-- CreateEnum
CREATE TYPE "FoodType" AS ENUM ('VEG', 'NON_VEG', 'VEGAN', 'EGG');

-- AlterTable: Product
ALTER TABLE "products" ADD COLUMN "gst_percent" DECIMAL(4,2),
ADD COLUMN "food_type" "FoodType",
ADD COLUMN "fssai_license" TEXT,
ADD COLUMN "ingredients" TEXT,
ADD COLUMN "nutritional_info" JSONB,
ADD COLUMN "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "serving_size" TEXT,
ADD COLUMN "shelf_life_days" INTEGER,
ADD COLUMN "storage_instructions" TEXT,
ADD COLUMN "manufacturer_name" TEXT,
ADD COLUMN "country_of_origin" TEXT,
ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: ProductVariant
ALTER TABLE "product_variants" ADD COLUMN "pack_type" TEXT;
