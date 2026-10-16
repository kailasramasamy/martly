-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('ORDERS_VIEW', 'ORDERS_PROCESS', 'ORDERS_DISPATCH', 'ORDERS_CANCEL', 'DELIVERY_DELIVER', 'RIDERS_MANAGE', 'CATALOG_PRODUCTS', 'CATALOG_BRANDS', 'CATALOG_COLLECTIONS', 'LISTING_AVAILABILITY', 'LISTING_MANAGE', 'LISTING_PRICES', 'STOCK_VIEW', 'STOCK_RECEIVE', 'STOCK_COUNT', 'STOCK_ADJUST', 'STOCK_APPROVE', 'RETURNS_HANDLE', 'SUPPORT_HANDLE', 'REFUNDS_ISSUE', 'MARKETING_MANAGE', 'DELIVERY_CONFIG', 'STORE_SETTINGS', 'TEAM_MANAGE', 'REPORTS_VIEW', 'FINANCE_MANAGE');

-- CreateTable
CREATE TABLE "member_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "permissions" "Permission"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_permissions_user_id_organization_id_key" ON "member_permissions"("user_id", "organization_id");

-- AddForeignKey
ALTER TABLE "member_permissions" ADD CONSTRAINT "member_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_permissions" ADD CONSTRAINT "member_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: keep today's access for existing staff and riders in each org they work in
INSERT INTO "member_permissions" ("id", "user_id", "organization_id", "permissions", "updated_at")
SELECT gen_random_uuid()::text, u."id", s."organization_id",
  CASE u."role"
    WHEN 'STAFF' THEN ARRAY['ORDERS_VIEW', 'ORDERS_PROCESS', 'ORDERS_DISPATCH', 'DELIVERY_DELIVER']::"Permission"[]
    ELSE ARRAY['ORDERS_DISPATCH']::"Permission"[]
  END,
  CURRENT_TIMESTAMP
FROM "users" u
JOIN "user_stores" us ON us."user_id" = u."id"
JOIN "stores" s ON s."id" = us."store_id"
WHERE u."role" IN ('STAFF', 'RIDER')
GROUP BY u."id", u."role", s."organization_id";
