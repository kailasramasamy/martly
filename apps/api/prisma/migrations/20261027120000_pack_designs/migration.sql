-- AlterTable
ALTER TABLE "products" ADD COLUMN     "pack_photo_url" TEXT;

-- CreateTable
CREATE TABLE "pack_designs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "front_art_url" TEXT NOT NULL,
    "back_art_url" TEXT,
    "zones" JSONB NOT NULL,
    "subcategory_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pack_designs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pack_designs_store_id_idx" ON "pack_designs"("store_id");

-- AddForeignKey
ALTER TABLE "pack_designs" ADD CONSTRAINT "pack_designs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_designs" ADD CONSTRAINT "pack_designs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

