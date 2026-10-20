-- CreateEnum
CREATE TYPE "RefundDestination" AS ENUM ('WALLET', 'CASH');

-- CreateEnum
CREATE TYPE "WalletTxnReason" AS ENUM ('ORDER_PAYMENT', 'CANCEL_REFUND', 'RETURN_REFUND', 'DOOR_REFUND', 'REFERRAL', 'RECHARGE', 'SUPPORT', 'SUBSCRIPTION', 'FORFEIT');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('SALE_ONLINE', 'SALE_WALLET', 'PLATFORM_COUPON', 'RETURN_REFUND', 'DOOR_REFUND', 'REFERRAL_REWARD', 'GOODWILL_DEBIT', 'MEMBERSHIP_SALE', 'PLAN_FEE', 'BALANCE_PAYMENT', 'REVERSAL', 'ADJUSTMENT', 'SETTLEMENT_PAYOUT');

-- CreateEnum
CREATE TYPE "LedgerSourceType" AS ENUM ('ORDER', 'RETURN', 'REFERRAL', 'MEMBERSHIP', 'WALLET_TXN', 'AD_ORDER', 'BALANCE_DUE', 'SETTLEMENT', 'LEDGER_ENTRY', 'MANUAL');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'FAILED', 'CARRIED_FORWARD');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BANK_TRANSFER', 'UPI');

-- CreateEnum
CREATE TYPE "BalanceDueStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_FINANCE';

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "refund_to" "RefundDestination" NOT NULL DEFAULT 'WALLET';

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN     "organization_id" TEXT,
ADD COLUMN     "reason" "WalletTxnReason",
ADD COLUMN     "store_id" TEXT;

-- Backfill: until now a credit could only be traced through its description
UPDATE "wallet_transactions" SET "reason" = CASE
  WHEN "description" LIKE 'Used for order%' THEN 'ORDER_PAYMENT'
  WHEN "description" LIKE 'Subscription order%' THEN 'SUBSCRIPTION'
  WHEN "description" LIKE 'Refund for cancelled order%' THEN 'CANCEL_REFUND'
  WHEN "description" LIKE 'Refund for return request%' THEN 'RETURN_REFUND'
  WHEN "description" LIKE 'Refund for items handed back%' THEN 'DOOR_REFUND'
  WHEN "description" ILIKE '%referral%' THEN 'REFERRAL'
  WHEN "description" LIKE 'Wallet recharge%' THEN 'RECHARGE'
  WHEN "description" LIKE 'Forfeited%' THEN 'FORFEIT'
  ELSE 'SUPPORT'
END::"WalletTxnReason";

UPDATE "wallet_transactions" w SET "store_id" = o."store_id", "organization_id" = s."organization_id"
FROM "orders" o JOIN "stores" s ON s."id" = o."store_id"
WHERE w."order_id" = o."id";

ALTER TABLE "wallet_transactions" ALTER COLUMN "reason" SET NOT NULL;

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "order_id" TEXT,
    "available_at" TIMESTAMP(3) NOT NULL,
    "settlement_id" TEXT,
    "memo" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "credits" DECIMAL(12,2) NOT NULL,
    "debits" DECIMAL(12,2) NOT NULL,
    "carried_in" DECIMAL(12,2) NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "payout_method" "PayoutMethod",
    "utr" TEXT,
    "paid_at" TIMESTAMP(3),
    "paid_by" TEXT,
    "failure_reason" TEXT,
    "carried_into_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_counters" (
    "fy" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "settlement_counters_pkey" PRIMARY KEY ("fy")
);

-- CreateTable
CREATE TABLE "org_payout_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "account_holder" TEXT NOT NULL,
    "account_number_enc" TEXT,
    "account_last4" TEXT,
    "ifsc" TEXT,
    "upi_vpa" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_dues" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "BalanceDueStatus" NOT NULL DEFAULT 'PENDING',
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "offline_reference" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balance_dues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_entries_organization_id_store_id_created_at_idx" ON "ledger_entries"("organization_id", "store_id", "created_at");

-- CreateIndex
CREATE INDEX "ledger_entries_organization_id_settlement_id_available_at_idx" ON "ledger_entries"("organization_id", "settlement_id", "available_at");

-- CreateIndex
CREATE INDEX "ledger_entries_order_id_idx" ON "ledger_entries"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_type_source_id_key" ON "ledger_entries"("type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_number_key" ON "settlements"("number");

-- CreateIndex
CREATE INDEX "settlements_organization_id_created_at_idx" ON "settlements"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "settlements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "org_payout_accounts_organization_id_key" ON "org_payout_accounts"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "balance_dues_razorpay_order_id_key" ON "balance_dues"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "balance_dues_razorpay_payment_id_key" ON "balance_dues"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "balance_dues_organization_id_status_idx" ON "balance_dues"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_carried_into_id_fkey" FOREIGN KEY ("carried_into_id") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_payout_accounts" ADD CONSTRAINT "org_payout_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_dues" ADD CONSTRAINT "balance_dues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

