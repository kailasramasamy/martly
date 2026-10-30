-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "pack_product_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "pack_cutout_aspect" DOUBLE PRECISION,
ADD COLUMN     "pack_cutout_url" TEXT;

-- CreateTable
CREATE TABLE "pack_tiles" (
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_tiles_pkey" PRIMARY KEY ("key")
);

