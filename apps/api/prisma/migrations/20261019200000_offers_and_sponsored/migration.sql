-- AlterEnum
ALTER TYPE "AdProductKind" ADD VALUE 'BRAND_SPONSORED_PRODUCT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BannerPlacement" ADD VALUE 'HOME_POSTER';
ALTER TYPE "BannerPlacement" ADD VALUE 'SPONSORED_PRODUCT';

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "show_on_home" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT;

