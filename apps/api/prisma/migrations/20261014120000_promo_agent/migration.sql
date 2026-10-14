-- CreateEnum
CREATE TYPE "PromoStatus" AS ENUM ('DRAFTING', 'READY', 'LIVE', 'ENDED', 'FAILED', 'DISCARDED');

-- AlterEnum
ALTER TYPE "CollectionKind" ADD VALUE 'PROMO';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "promo_discount_cap" INTEGER NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE "promos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "status" "PromoStatus" NOT NULL DEFAULT 'DRAFTING',
    "auto_launch" BOOLEAN NOT NULL DEFAULT false,
    "notify" BOOLEAN NOT NULL DEFAULT true,
    "failure_reason" TEXT,
    "assumptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agent_log" JSONB NOT NULL DEFAULT '[]',
    "copy" JSONB,
    "push" JSONB,
    "discount_type" "DiscountType",
    "discount_value" DECIMAL(10,2),
    "duration_days" INTEGER NOT NULL DEFAULT 7,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "collection_id" TEXT,
    "banner_id" TEXT,
    "campaign_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_price_changes" (
    "id" TEXT NOT NULL,
    "promo_id" TEXT NOT NULL,
    "store_product_id" TEXT NOT NULL,
    "prev_discount_type" "DiscountType",
    "prev_discount_value" DECIMAL(10,2),
    "prev_discount_start" TIMESTAMP(3),
    "prev_discount_end" TIMESTAMP(3),
    "restored_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promos_collection_id_key" ON "promos"("collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "promos_banner_id_key" ON "promos"("banner_id");

-- CreateIndex
CREATE UNIQUE INDEX "promos_campaign_id_key" ON "promos"("campaign_id");

-- CreateIndex
CREATE INDEX "promos_organization_id_status_idx" ON "promos"("organization_id", "status");

-- CreateIndex
CREATE INDEX "promos_status_ends_at_idx" ON "promos"("status", "ends_at");

-- CreateIndex
CREATE INDEX "promo_price_changes_store_product_id_idx" ON "promo_price_changes"("store_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "promo_price_changes_promo_id_store_product_id_key" ON "promo_price_changes"("promo_id", "store_product_id");

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "banners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "notification_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_price_changes" ADD CONSTRAINT "promo_price_changes_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_price_changes" ADD CONSTRAINT "promo_price_changes_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "store_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

