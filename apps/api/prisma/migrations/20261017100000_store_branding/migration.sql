-- AlterTable
ALTER TABLE "stores" ADD COLUMN "logo_url" TEXT,
ADD COLUMN "promo_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "tagline" TEXT,
ADD COLUMN "offer_text" TEXT,
ADD COLUMN "brand_color" TEXT,
ADD COLUMN "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "translations" JSONB;
