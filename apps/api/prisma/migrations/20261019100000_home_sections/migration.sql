-- CreateEnum
CREATE TYPE "HomeSectionType" AS ENUM ('FESTIVE_HERO', 'MEMBER_CHIPS', 'HERO_BANNERS', 'BUY_AGAIN', 'RECENTLY_VIEWED', 'DEPARTMENT_GRID', 'BRAND_RAIL', 'PLUS_PROMO', 'MID_BANNERS', 'TIME_PICKS', 'DEALS', 'RECIPES', 'LIVE_CAMPAIGNS', 'OTHER_COLLECTIONS', 'CATEGORY_DIRECTORY', 'OFFERS', 'BRAND_POSTERS', 'PERSONALISED', 'PRODUCT_ROW', 'CAMPAIGN_CARD', 'TABBED_ROW', 'PRICE_BAND_DEALS', 'BRAND_CARD', 'EXPLORE_GRID', 'STORE_GRID');

-- CreateTable
CREATE TABLE "home_sections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "HomeSectionType" NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "translations" JSONB,
    "collection_id" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_section_items" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "translations" JSONB,
    "image_url" TEXT,
    "collection_id" TEXT,
    "subcategory_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wide" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "home_section_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_sections_organization_id_is_active_sort_order_idx" ON "home_sections"("organization_id", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "home_section_items_section_id_idx" ON "home_section_items"("section_id");

-- AddForeignKey
ALTER TABLE "home_sections" ADD CONSTRAINT "home_sections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_sections" ADD CONSTRAINT "home_sections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_section_items" ADD CONSTRAINT "home_section_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "home_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_section_items" ADD CONSTRAINT "home_section_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

