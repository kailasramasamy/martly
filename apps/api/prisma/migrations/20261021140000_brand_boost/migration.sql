-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "boost_own_brands" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "org_brand_features" (
    "organization_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_brand_features_pkey" PRIMARY KEY ("organization_id","brand_id")
);

-- AddForeignKey
ALTER TABLE "org_brand_features" ADD CONSTRAINT "org_brand_features_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_brand_features" ADD CONSTRAINT "org_brand_features_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

