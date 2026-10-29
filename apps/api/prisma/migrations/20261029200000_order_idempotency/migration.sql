-- The app sends an Idempotency-Key with each checkout attempt; a retried POST /orders with the same key from the same
-- user returns the order already placed instead of placing it twice. Orders placed without a key keep it NULL
-- (NULLs never collide in a unique index).
ALTER TABLE "orders" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "orders_user_id_idempotency_key_key" ON "orders"("user_id", "idempotency_key");
