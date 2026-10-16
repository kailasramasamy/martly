-- CreateEnum
CREATE TYPE "DeliveryFailureReason" AS ENUM ('CUSTOMER_UNAVAILABLE', 'WRONG_ADDRESS', 'CUSTOMER_REFUSED', 'PAYMENT_ISSUE', 'OTHER');

-- CreateTable
CREATE TABLE "delivery_failures" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "reason" "DeliveryFailureReason" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_failures_order_id_idx" ON "delivery_failures"("order_id");

-- CreateIndex
CREATE INDEX "delivery_failures_rider_id_created_at_idx" ON "delivery_failures"("rider_id", "created_at");

-- AddForeignKey
ALTER TABLE "delivery_failures" ADD CONSTRAINT "delivery_failures_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_failures" ADD CONSTRAINT "delivery_failures_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "delivery_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_failures" ADD CONSTRAINT "delivery_failures_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

