-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "source_section_id" TEXT,
ADD COLUMN     "source_section_type" TEXT;
-- CreateTable
CREATE TABLE "home_section_stats_daily" (
    "store_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "section_type" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "taps" INTEGER NOT NULL DEFAULT 0,
    "cart_adds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "home_section_stats_daily_pkey" PRIMARY KEY ("store_id","section_id","date")
);
-- CreateTable
CREATE TABLE "storefront_health_snapshots" (
    "store_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "groups" JSONB NOT NULL,
    CONSTRAINT "storefront_health_snapshots_pkey" PRIMARY KEY ("store_id","date")
);
-- CreateIndex
CREATE INDEX "home_section_stats_daily_store_id_date_idx" ON "home_section_stats_daily"("store_id", "date");
-- AddForeignKey
ALTER TABLE "home_section_stats_daily" ADD CONSTRAINT "home_section_stats_daily_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "storefront_health_snapshots" ADD CONSTRAINT "storefront_health_snapshots_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
