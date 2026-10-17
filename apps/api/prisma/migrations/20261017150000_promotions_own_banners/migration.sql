-- Promotions become the single starting point: a promotion owns any number of banners

CREATE TYPE "PromoKind" AS ENUM ('AI', 'MANUAL');

ALTER TABLE "banners" ADD COLUMN "promo_id" TEXT,
ADD COLUMN "slot_free" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "promos" ADD COLUMN "action_target" TEXT,
ADD COLUMN "action_type" "BannerActionType",
ADD COLUMN "kind" "PromoKind" NOT NULL DEFAULT 'AI',
ADD COLUMN "launch_at" TIMESTAMP(3);

-- Each existing (AI) promotion's banner now points back at it; the credit covers it, so it takes no slot
UPDATE "banners" b SET "promo_id" = p."id", "slot_free" = true
FROM "promos" p WHERE p."banner_id" = b."id";

-- Every standalone banner of an organisation becomes a manual promotion with the same copy, target and dates
INSERT INTO "promos" ("id", "organization_id", "created_by_id", "brief", "status", "kind", "notify", "copy",
  "action_type", "action_target", "starts_at", "ends_at", "launch_at", "duration_days", "updated_at")
SELECT md5(b."id" || ':promo')::uuid::text, b."organization_id",
  COALESCE(
    (SELECT u."id" FROM "users" u JOIN "user_stores" us ON us."user_id" = u."id" JOIN "stores" s ON s."id" = us."store_id"
      WHERE u."role" = 'ORG_ADMIN' AND s."organization_id" = b."organization_id" ORDER BY u."created_at" LIMIT 1),
    (SELECT u."id" FROM "users" u WHERE u."role" = 'SUPER_ADMIN' ORDER BY u."created_at" LIMIT 1)),
  b."title",
  (CASE
    WHEN b."ends_at" IS NOT NULL AND b."ends_at" < NOW() THEN 'ENDED'
    WHEN NOT b."is_active" THEN 'ENDED'
    WHEN b."starts_at" IS NOT NULL AND b."starts_at" > NOW() THEN 'READY'
    ELSE 'LIVE' END)::"PromoStatus",
  'MANUAL', false,
  jsonb_build_object('en', jsonb_build_object('title', b."title", 'subtitle', COALESCE(b."subtitle", ''))),
  b."action_type", b."action_target",
  CASE WHEN b."starts_at" IS NOT NULL AND b."starts_at" > NOW() THEN NULL ELSE COALESCE(b."starts_at", b."created_at") END,
  CASE WHEN b."starts_at" IS NOT NULL AND b."starts_at" > NOW() THEN NULL ELSE b."ends_at" END,
  CASE WHEN b."starts_at" IS NOT NULL AND b."starts_at" > NOW() THEN b."starts_at" END,
  CASE WHEN b."ends_at" IS NOT NULL THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (b."ends_at" - COALESCE(b."starts_at", b."created_at"))) / 86400))::int ELSE 7 END,
  NOW()
FROM "banners" b
WHERE b."organization_id" IS NOT NULL AND b."sponsor_type" = 'STORE' AND b."promo_id" IS NULL;

UPDATE "banners" b SET "promo_id" = md5(b."id" || ':promo')::uuid::text
WHERE b."organization_id" IS NOT NULL AND b."sponsor_type" = 'STORE' AND b."promo_id" IS NULL;

ALTER TABLE "promos" DROP CONSTRAINT "promos_banner_id_fkey";
DROP INDEX "promos_banner_id_key";
ALTER TABLE "promos" DROP COLUMN "banner_id";

CREATE INDEX "banners_promo_id_idx" ON "banners"("promo_id");
ALTER TABLE "banners" ADD CONSTRAINT "banners_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
