-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_slot_id" TEXT,
ADD COLUMN     "scheduled_date" TIMESTAMP(3),
ADD COLUMN     "slot_end_time" TEXT,
ADD COLUMN     "slot_start_time" TEXT;

-- CreateTable
CREATE TABLE "delivery_slots" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "max_orders" INTEGER NOT NULL DEFAULT 20,
    "cutoff_minutes" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_slots_store_id_idx" ON "delivery_slots"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_slots_store_id_day_of_week_start_time_end_time_key" ON "delivery_slots"("store_id", "day_of_week", "start_time", "end_time");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_slot_id_fkey" FOREIGN KEY ("delivery_slot_id") REFERENCES "delivery_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_slots" ADD CONSTRAINT "delivery_slots_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
