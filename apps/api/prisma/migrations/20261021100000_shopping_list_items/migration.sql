-- A customer's running shopping list
-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "done_at" TIMESTAMP(3),

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopping_list_items_user_id_done_at_idx" ON "shopping_list_items"("user_id", "done_at");

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

