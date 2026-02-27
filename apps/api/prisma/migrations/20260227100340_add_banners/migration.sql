-- CreateEnum
CREATE TYPE "BannerPlacement" AS ENUM ('HERO_CAROUSEL', 'CATEGORY_STRIP', 'MID_PAGE', 'CATEGORY_TOP', 'CART_UPSELL', 'POPUP');

-- CreateEnum
CREATE TYPE "BannerActionType" AS ENUM ('CATEGORY', 'PRODUCT', 'COLLECTION', 'SEARCH', 'URL', 'NONE');

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image_url" TEXT NOT NULL,
    "placement" "BannerPlacement" NOT NULL,
    "action_type" "BannerActionType" NOT NULL DEFAULT 'NONE',
    "action_target" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "store_id" TEXT,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banners_placement_is_active_idx" ON "banners"("placement", "is_active");

-- CreateIndex
CREATE INDEX "banners_organization_id_idx" ON "banners"("organization_id");

-- CreateIndex
CREATE INDEX "banners_store_id_idx" ON "banners"("store_id");

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
