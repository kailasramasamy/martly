-- CreateEnum
CREATE TYPE "AiImagePurpose" AS ENUM ('PROMO_BANNER', 'COLLECTION_BANNER', 'FESTIVE_HERO', 'HOME_TILES');

-- AlterEnum
ALTER TYPE "AdProductKind" ADD VALUE 'AI_IMAGE_PACK';

-- AlterTable
ALTER TABLE "ad_products" ADD COLUMN     "ai_image_credits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ai_image_credit_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "from_plan" BOOLEAN NOT NULL DEFAULT false,
    "reason" "PromotionCreditReason" NOT NULL,
    "purpose" "AiImagePurpose",
    "ref_id" TEXT,
    "ad_order_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_image_credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_image_credit_entries_organization_id_created_at_idx" ON "ai_image_credit_entries"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_image_credit_entries" ADD CONSTRAINT "ai_image_credit_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_image_credit_entries" ADD CONSTRAINT "ai_image_credit_entries_ad_order_id_fkey" FOREIGN KEY ("ad_order_id") REFERENCES "ad_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

