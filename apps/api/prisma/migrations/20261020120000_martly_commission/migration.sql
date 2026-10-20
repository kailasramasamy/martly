-- Martly commission per organization, recorded per order on delivery
ALTER TYPE "LedgerEntryType" ADD VALUE 'COMMISSION';
ALTER TYPE "LedgerEntryType" ADD VALUE 'COMMISSION_REFUND';

ALTER TABLE "organizations"
  ADD COLUMN "online_commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 4,
  ADD COLUMN "cod_commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 2;

ALTER TABLE "orders"
  ADD COLUMN "commission_base" DECIMAL(10,2),
  ADD COLUMN "commission_amount" DECIMAL(10,2);
