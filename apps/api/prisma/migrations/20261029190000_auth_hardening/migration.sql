-- A phone is an OTP login, so it can belong to one account only.

-- An empty phone means no phone
UPDATE "users" SET "phone" = NULL WHERE btrim("phone") = '';

-- Accounts sharing a phone keep it on one account: a live one first, then the one whose OTP login proved the number,
-- then a staff login, then the oldest. The others lose the phone; the table below records what was taken, for support.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "phone" IS NOT NULL GROUP BY "phone" HAVING COUNT(*) > 1) THEN
    CREATE TABLE "users_phone_dedup_20261029" (
      "user_id"    TEXT PRIMARY KEY,
      "phone"      TEXT NOT NULL,
      "removed_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    INSERT INTO "users_phone_dedup_20261029" ("user_id", "phone")
    SELECT "id", "phone" FROM (
      SELECT "id", "phone", ROW_NUMBER() OVER (
        PARTITION BY "phone"
        ORDER BY ("deleted_at" IS NULL) DESC,
                 ("email" = "phone" || '@phone.martly.app') DESC,
                 ("role" <> 'CUSTOMER') DESC,
                 "created_at" ASC
      ) AS "rank"
      FROM "users" WHERE "phone" IS NOT NULL
    ) AS "ranked"
    WHERE "rank" > 1;

    UPDATE "users" SET "phone" = NULL WHERE "id" IN (SELECT "user_id" FROM "users_phone_dedup_20261029");
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
