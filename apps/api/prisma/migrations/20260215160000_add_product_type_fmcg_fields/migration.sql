-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('GROCERY', 'SNACKS', 'BEVERAGES', 'DAIRY', 'FROZEN', 'FRESH_PRODUCE', 'BAKERY', 'PERSONAL_CARE', 'HOUSEHOLD', 'BABY_CARE', 'PET_CARE', 'OTC_PHARMA');

-- AlterTable: Product – add FMCG fields
ALTER TABLE "products" ADD COLUMN "product_type" "ProductType",
ADD COLUMN "regulatory_marks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "mfg_license_no" TEXT,
ADD COLUMN "danger_warnings" TEXT,
ADD COLUMN "usage_instructions" TEXT;

-- CreateIndex
CREATE INDEX "products_product_type_idx" ON "products"("product_type");
