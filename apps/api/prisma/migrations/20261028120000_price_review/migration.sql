-- CreateEnum
CREATE TYPE "PriceReviewOutcome" AS ENUM ('KEPT', 'CHANGED');

-- AlterTable
ALTER TABLE "store_products" ADD COLUMN "mrp" DECIMAL(10,2),
ADD COLUMN "price_reviewed_at" TIMESTAMP(3),
ADD COLUMN "price_reviewed_by_id" TEXT,
ADD COLUMN "price_review_outcome" "PriceReviewOutcome",
ADD COLUMN "carried" BOOLEAN,
ADD COLUMN "carried_before" BOOLEAN,
ADD COLUMN "carry_checked_at" TIMESTAMP(3),
ADD COLUMN "carry_checked_by_id" TEXT,
ADD COLUMN "suggested" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "store_products_store_id_price_reviewed_at_idx" ON "store_products"("store_id", "price_reviewed_at");
CREATE INDEX "store_products_store_id_carried_idx" ON "store_products"("store_id", "carried");

-- AddForeignKey
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_price_reviewed_by_id_fkey" FOREIGN KEY ("price_reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_carry_checked_by_id_fkey" FOREIGN KEY ("carry_checked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
