-- CreateTable
CREATE TABLE "express_delivery_configs" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "eta_minutes" INTEGER,
    "operating_start" TEXT,
    "operating_end" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "express_delivery_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "express_delivery_configs_store_id_key" ON "express_delivery_configs"("store_id");

-- AddForeignKey
ALTER TABLE "express_delivery_configs" ADD CONSTRAINT "express_delivery_configs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
