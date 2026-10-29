-- CreateEnum
CREATE TYPE "CreditGrantStatus" AS ENUM ('ACTIVE', 'RESERVED', 'USED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'PLATFORM_CREDIT';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "credit_discount" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "credit_campaigns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "store_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "min_order_amount" DECIMAL(10,2) NOT NULL,
    "valid_days" INTEGER NOT NULL,
    "budget" DECIMAL(12,2) NOT NULL,
    "headline" TEXT,
    "message" TEXT,
    "translations" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_grants" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "funder_key" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "CreditGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "order_id" TEXT,
    "used_at" TIMESTAMP(3),
    "announced_at" TIMESTAMP(3),
    "reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_campaigns_store_id_is_active_idx" ON "credit_campaigns"("store_id", "is_active");

-- CreateIndex
CREATE INDEX "credit_campaigns_organization_id_idx" ON "credit_campaigns"("organization_id");

-- CreateIndex
CREATE INDEX "credit_grants_campaign_id_status_idx" ON "credit_grants"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "credit_grants_user_id_status_idx" ON "credit_grants"("user_id", "status");

-- CreateIndex
CREATE INDEX "credit_grants_order_id_idx" ON "credit_grants"("order_id");

-- CreateIndex
CREATE INDEX "credit_grants_status_expires_at_idx" ON "credit_grants"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "credit_grants_funder_key_phone_key" ON "credit_grants"("funder_key", "phone");

-- AddForeignKey
ALTER TABLE "credit_campaigns" ADD CONSTRAINT "credit_campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_campaigns" ADD CONSTRAINT "credit_campaigns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "credit_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
