CREATE INDEX "products_tags_idx" ON "products" USING GIN ("tags");
