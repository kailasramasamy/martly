-- CreateEnum
CREATE TYPE "CatalogDraftStatus" AS ENUM ('QUEUED', 'PROCESSING', 'NEEDS_REVIEW', 'PUBLISHED', 'DUPLICATE', 'FAILED', 'DISCARDED');

-- CreateTable
CREATE TABLE "catalog_drafts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "status" "CatalogDraftStatus" NOT NULL DEFAULT 'QUEUED',
    "hint_name" TEXT,
    "mrp" DECIMAL(10,2) NOT NULL,
    "selling_price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "photos" TEXT[],
    "processed_images" JSONB NOT NULL DEFAULT '[]',
    "extracted" JSONB,
    "review_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "product_id" TEXT,
    "matched_existing" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "usage" JSONB NOT NULL DEFAULT '[]',
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_drafts_status_claimed_at_idx" ON "catalog_drafts"("status", "claimed_at");

-- CreateIndex
CREATE INDEX "catalog_drafts_store_id_created_at_idx" ON "catalog_drafts"("store_id", "created_at");

-- AddForeignKey
ALTER TABLE "catalog_drafts" ADD CONSTRAINT "catalog_drafts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_drafts" ADD CONSTRAINT "catalog_drafts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_drafts" ADD CONSTRAINT "catalog_drafts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_drafts" ADD CONSTRAINT "catalog_drafts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

