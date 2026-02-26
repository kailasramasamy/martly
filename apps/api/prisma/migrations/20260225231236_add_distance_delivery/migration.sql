-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_distance" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "delivery_radius" DOUBLE PRECISION NOT NULL DEFAULT 7,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "user_addresses" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "pincode" TEXT;

-- CreateTable
CREATE TABLE "delivery_tiers" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "min_distance" DOUBLE PRECISION NOT NULL,
    "max_distance" DOUBLE PRECISION NOT NULL,
    "delivery_fee" DECIMAL(10,2) NOT NULL,
    "estimated_minutes" INTEGER NOT NULL DEFAULT 45,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_tiers_store_id_idx" ON "delivery_tiers"("store_id");

-- AddForeignKey
ALTER TABLE "delivery_tiers" ADD CONSTRAINT "delivery_tiers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
