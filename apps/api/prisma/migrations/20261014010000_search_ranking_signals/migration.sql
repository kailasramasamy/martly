-- CreateEnum
CREATE TYPE "SearchEventType" AS ENUM ('CLICK', 'ADD_TO_CART');

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "popularity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subcategories" ADD COLUMN     "search_terms" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "search_events" (
    "id" TEXT NOT NULL,
    "search_log_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" "SearchEventType" NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_events_product_id_idx" ON "search_events"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_events_search_log_id_product_id_type_key" ON "search_events"("search_log_id", "product_id", "type");

-- CreateIndex
CREATE INDEX "subcategories_search_terms_idx" ON "subcategories" USING GIN ("search_terms");

-- AddForeignKey
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_search_log_id_fkey" FOREIGN KEY ("search_log_id") REFERENCES "search_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

