-- Towns: stores are listed under a town (onmartly.in/{town}/{store}), so store slugs only need to be unique within one
CREATE TABLE "towns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "towns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "towns_slug_key" ON "towns"("slug");
CREATE UNIQUE INDEX "towns_state_district_name_key" ON "towns"("state", "district", "name");

-- Existing stores start in a town named after their district; Martly moves them to their real town afterwards
INSERT INTO "towns" ("id", "name", "slug", "district", "state", "updated_at")
SELECT gen_random_uuid()::text, d.district,
       CASE WHEN count(*) OVER (PARTITION BY d.base) > 1 THEN d.base || '-' || d.state_slug ELSE d.base END,
       d.district, d.state, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT trim("district") AS district, "state",
         trim(both '-' from regexp_replace(lower(trim("district")), '[^a-z0-9]+', '-', 'g')) AS base,
         trim(both '-' from regexp_replace(lower("state"), '[^a-z0-9]+', '-', 'g')) AS state_slug
  FROM "stores"
  WHERE "district" IS NOT NULL AND "state" IS NOT NULL
) d;

ALTER TABLE "stores" ADD COLUMN "town_id" TEXT;

UPDATE "stores" s SET "town_id" = t."id"
FROM "towns" t
WHERE t."state" = s."state" AND t."district" = trim(s."district") AND t."name" = trim(s."district");

ALTER TABLE "stores" ALTER COLUMN "town_id" SET NOT NULL;

DROP INDEX "stores_slug_key";
CREATE UNIQUE INDEX "stores_town_id_slug_key" ON "stores"("town_id", "slug");

ALTER TABLE "stores" ADD CONSTRAINT "stores_town_id_fkey" FOREIGN KEY ("town_id") REFERENCES "towns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
