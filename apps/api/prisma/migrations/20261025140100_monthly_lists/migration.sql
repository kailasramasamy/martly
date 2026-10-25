-- CreateTable
CREATE TABLE "monthly_lists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "reminder_day" INTEGER NOT NULL,
    "push_on" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_on" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_reminded_month" TEXT,
    "last_ordered_month" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_list_items" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "last_price" DECIMAL(10,2),
    "last_ordered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_lists_reminder_day_is_active_idx" ON "monthly_lists"("reminder_day", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_lists_user_id_store_id_key" ON "monthly_lists"("user_id", "store_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_list_items_list_id_variant_id_key" ON "monthly_list_items"("list_id", "variant_id");

-- AddForeignKey
ALTER TABLE "monthly_lists" ADD CONSTRAINT "monthly_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_lists" ADD CONSTRAINT "monthly_lists_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_list_items" ADD CONSTRAINT "monthly_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "monthly_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_list_items" ADD CONSTRAINT "monthly_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_list_items" ADD CONSTRAINT "monthly_list_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

