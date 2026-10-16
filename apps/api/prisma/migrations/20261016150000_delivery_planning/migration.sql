-- CreateEnum
CREATE TYPE "TripWave" AS ENUM ('SLOT', 'EXPRESS');

-- AlterEnum
ALTER TYPE "TripStatus" ADD VALUE 'PLANNED';

-- AlterTable
ALTER TABLE "delivery_trips" ADD COLUMN     "area_label" TEXT,
ADD COLUMN     "delivery_slot_id" TEXT,
ADD COLUMN     "planned_distance_m" INTEGER,
ADD COLUMN     "planned_duration_s" INTEGER,
ADD COLUMN     "slot_date" DATE,
ADD COLUMN     "wave" "TripWave" NOT NULL DEFAULT 'EXPRESS',
ALTER COLUMN "rider_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "store_delivery_settings" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "max_orders_per_trip" INTEGER NOT NULL DEFAULT 8,
    "max_trips_per_rider" INTEGER NOT NULL DEFAULT 2,
    "express_batch_size" INTEGER NOT NULL DEFAULT 3,
    "express_max_wait_minutes" INTEGER NOT NULL DEFAULT 10,
    "auto_plan" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_delivery_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_riders" (
    "id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_rider_overrides" (
    "id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "working" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_rider_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_delivery_settings_store_id_key" ON "store_delivery_settings"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "slot_riders_slot_id_rider_id_key" ON "slot_riders"("slot_id", "rider_id");

-- CreateIndex
CREATE UNIQUE INDEX "slot_rider_overrides_slot_id_rider_id_date_key" ON "slot_rider_overrides"("slot_id", "rider_id", "date");

-- CreateIndex
CREATE INDEX "delivery_trips_store_id_slot_date_idx" ON "delivery_trips"("store_id", "slot_date");

-- AddForeignKey
ALTER TABLE "delivery_trips" ADD CONSTRAINT "delivery_trips_delivery_slot_id_fkey" FOREIGN KEY ("delivery_slot_id") REFERENCES "delivery_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_delivery_settings" ADD CONSTRAINT "store_delivery_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_riders" ADD CONSTRAINT "slot_riders_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "delivery_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_riders" ADD CONSTRAINT "slot_riders_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_rider_overrides" ADD CONSTRAINT "slot_rider_overrides_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "delivery_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_rider_overrides" ADD CONSTRAINT "slot_rider_overrides_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

