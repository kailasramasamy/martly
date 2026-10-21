-- AlterTable
ALTER TABLE "banners" ADD COLUMN     "target_districts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "target_states" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "brand_campaigns" ADD COLUMN     "target_districts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "target_states" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "allow_brand_ads";

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "district" TEXT,
ADD COLUMN     "state" TEXT;


-- Every store so far is in Dharmapuri, Tamil Nadu; others are set from the admin store form
UPDATE "stores" SET "state" = 'Tamil Nadu', "district" = 'Dharmapuri' WHERE "address" ILIKE '%Dharmapuri%';
