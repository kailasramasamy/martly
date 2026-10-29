-- Delivery fees come only from a store's distance tiers
ALTER TABLE "stores" DROP COLUMN "base_delivery_fee";
