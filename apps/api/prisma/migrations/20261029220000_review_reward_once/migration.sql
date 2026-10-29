-- A verified review earns its loyalty reward once: approving it again (after a reject) no longer pays again
ALTER TABLE "reviews" ADD COLUMN "loyalty_rewarded_at" TIMESTAMP(3);

-- Reviews already approved and verified were rewarded when approved (where the store's loyalty was on)
UPDATE "reviews" SET "loyalty_rewarded_at" = "updated_at" WHERE "status" = 'APPROVED' AND "is_verified" = true;
