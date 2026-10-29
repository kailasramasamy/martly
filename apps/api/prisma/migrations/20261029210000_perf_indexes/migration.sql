-- Search: the trigram indexes 20260302123022 dropped, and an index for the full-text match on search_text
CREATE INDEX IF NOT EXISTS "products_search_text_trgm_idx" ON "products" USING GIN ("search_text" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "search_aliases_alias_trgm_idx" ON "search_aliases" USING GIN ("alias" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "products_search_text_fts_idx" ON "products" USING GIN (to_tsvector('english', "search_text"));

-- Orders: a customer's history, a store's recent orders, slot and trip boards, Razorpay webhook lookups
CREATE INDEX IF NOT EXISTS "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "orders_store_id_created_at_idx" ON "orders"("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "orders_delivery_slot_id_scheduled_date_idx" ON "orders"("delivery_slot_id", "scheduled_date");
CREATE INDEX IF NOT EXISTS "orders_delivery_trip_id_idx" ON "orders"("delivery_trip_id");
CREATE INDEX IF NOT EXISTS "orders_razorpay_order_id_idx" ON "orders"("razorpay_order_id");

-- Foreign keys joined on every order and catalog read
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items"("product_id");
CREATE INDEX IF NOT EXISTS "product_variants_product_id_idx" ON "product_variants"("product_id");
CREATE INDEX IF NOT EXISTS "store_products_product_id_idx" ON "store_products"("product_id");
