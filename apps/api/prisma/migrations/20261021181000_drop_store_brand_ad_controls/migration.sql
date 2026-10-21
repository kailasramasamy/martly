-- Brands pay Martly for reach, so stores no longer block brands or sit out brand promotions
-- DropForeignKey
ALTER TABLE "brand_campaign_opt_outs" DROP CONSTRAINT "brand_campaign_opt_outs_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "brand_campaign_opt_outs" DROP CONSTRAINT "brand_campaign_opt_outs_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "org_brand_blocks" DROP CONSTRAINT "org_brand_blocks_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "org_brand_blocks" DROP CONSTRAINT "org_brand_blocks_organization_id_fkey";

-- DropTable
DROP TABLE "brand_campaign_opt_outs";

-- DropTable
DROP TABLE "org_brand_blocks";

