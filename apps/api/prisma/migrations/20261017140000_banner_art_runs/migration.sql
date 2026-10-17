-- CreateEnum
CREATE TYPE "BannerArtPurpose" AS ENUM ('PROMO', 'SEASONAL', 'BANNER', 'BRAND');

-- AlterTable
ALTER TABLE "ad_products" ADD COLUMN     "ai_images_per_month" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "banner_art_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "brand_id" TEXT,
    "purpose" "BannerArtPurpose" NOT NULL,
    "layout" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banner_art_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banner_art_runs_organization_id_created_at_idx" ON "banner_art_runs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "banner_art_runs_brand_id_created_at_idx" ON "banner_art_runs"("brand_id", "created_at");

-- AddForeignKey
ALTER TABLE "banner_art_runs" ADD CONSTRAINT "banner_art_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AI banner images included in the paid plans
UPDATE "ad_products" SET "ai_images_per_month" = CASE "code" WHEN 'FREE' THEN 2 WHEN 'GROWTH' THEN 10 WHEN 'PRO' THEN 30 ELSE 0 END;
