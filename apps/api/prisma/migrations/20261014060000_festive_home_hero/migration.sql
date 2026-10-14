-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "hero_image_url" TEXT,
ADD COLUMN     "hero_theme" JSONB,
ADD COLUMN     "hero_title" TEXT;

-- CreateTable
CREATE TABLE "collection_tiles" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "translations" JSONB,
    "image_url" TEXT NOT NULL,
    "subcategory_ids" TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_tiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_tiles_collection_id_idx" ON "collection_tiles"("collection_id");

-- AddForeignKey
ALTER TABLE "collection_tiles" ADD CONSTRAINT "collection_tiles_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

