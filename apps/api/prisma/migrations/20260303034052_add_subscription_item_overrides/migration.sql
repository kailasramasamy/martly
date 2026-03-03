-- CreateTable
CREATE TABLE "subscription_item_overrides" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "store_product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "delivery_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_item_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_item_overrides_subscription_id_store_product_i_key" ON "subscription_item_overrides"("subscription_id", "store_product_id", "delivery_date");

-- AddForeignKey
ALTER TABLE "subscription_item_overrides" ADD CONSTRAINT "subscription_item_overrides_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_item_overrides" ADD CONSTRAINT "subscription_item_overrides_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "store_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
