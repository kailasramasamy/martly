-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "razorpay_order_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "previous_membership_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "razorpay_order_id" TEXT NOT NULL,
    "razorpay_payment_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_razorpay_order_id_key" ON "payment_attempts"("razorpay_order_id");

-- CreateIndex
CREATE INDEX "payment_attempts_order_id_idx" ON "payment_attempts"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_purchases_razorpay_order_id_key" ON "membership_purchases"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_purchases_razorpay_payment_id_key" ON "membership_purchases"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "membership_purchases_user_id_idx" ON "membership_purchases"("user_id");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_purchases" ADD CONSTRAINT "membership_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_purchases" ADD CONSTRAINT "membership_purchases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_purchases" ADD CONSTRAINT "membership_purchases_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: the Razorpay order each order last prepared becomes its first attempt, charging what the order still owes
-- online (total less wallet and points), so payments in flight at deploy still settle
INSERT INTO "payment_attempts" ("id", "order_id", "razorpay_order_id", "amount", "created_at")
SELECT gen_random_uuid()::text, o."id", o."razorpay_order_id",
       ROUND((o."total_amount" - COALESCE(o."wallet_amount_used", 0) - COALESCE(o."loyalty_points_used", 0)) * 100)::int,
       o."updated_at"
FROM "orders" o
WHERE o."razorpay_order_id" IS NOT NULL
ON CONFLICT ("razorpay_order_id") DO NOTHING;
