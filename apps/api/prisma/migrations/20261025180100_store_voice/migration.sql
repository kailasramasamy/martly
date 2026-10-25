-- CreateEnum
CREATE TYPE "StorePostKind" AS ENUM ('FRESH_TODAY', 'NEW_IN_STORE', 'BACK_IN_STOCK');

-- CreateTable
CREATE TABLE "store_posts" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "kind" "StorePostKind" NOT NULL,
    "text" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "translations" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_post_products" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "store_post_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_picks" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "translations" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_picks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_posts_store_id_expires_at_idx" ON "store_posts"("store_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "store_post_products_post_id_product_id_key" ON "store_post_products"("post_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_picks_store_id_product_id_key" ON "store_picks"("store_id", "product_id");

-- AddForeignKey
ALTER TABLE "store_posts" ADD CONSTRAINT "store_posts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_posts" ADD CONSTRAINT "store_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_post_products" ADD CONSTRAINT "store_post_products_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "store_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_post_products" ADD CONSTRAINT "store_post_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_picks" ADD CONSTRAINT "store_picks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_picks" ADD CONSTRAINT "store_picks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_picks" ADD CONSTRAINT "store_picks_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
