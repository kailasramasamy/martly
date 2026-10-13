-- AlterTable
ALTER TABLE "banners" ADD COLUMN     "image_urls" JSONB,
ADD COLUMN     "text_in_image" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "art_direction" TEXT,
ADD COLUMN     "image_urls" JSONB,
ADD COLUMN     "text_in_image" BOOLEAN NOT NULL DEFAULT false;

