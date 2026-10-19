-- Live queue counts, order lists and the attention checks all filter orders by store and status
CREATE INDEX IF NOT EXISTS "orders_store_id_status_idx" ON "orders"("store_id", "status");
