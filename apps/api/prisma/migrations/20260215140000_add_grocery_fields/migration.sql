-- AlterTable: Add grocery fields to products
ALTER TABLE "products" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "products" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ADD COLUMN "hsn_code" TEXT;

-- AlterTable: Add barcode and mrp to product_variants
ALTER TABLE "product_variants" ADD COLUMN "barcode" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "mrp" DECIMAL(10,2);

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_barcode_key" ON "product_variants"("barcode");
