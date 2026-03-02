-- AlterTable
ALTER TABLE "users" ADD COLUMN "razorpay_customer_id" TEXT,
ADD COLUMN "preferred_payment_method" TEXT,
ADD COLUMN "last_upi_vpa" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_razorpay_customer_id_key" ON "users"("razorpay_customer_id");
