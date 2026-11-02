-- CreateTable
CREATE TABLE "brand_category_popularity" (
    "brand_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "popularity" INTEGER NOT NULL,

    CONSTRAINT "brand_category_popularity_pkey" PRIMARY KEY ("brand_id","category_id","region")
);

-- CreateTable
CREATE TABLE "brand_subcategory_popularity" (
    "brand_id" TEXT NOT NULL,
    "subcategory_id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "popularity" INTEGER NOT NULL,

    CONSTRAINT "brand_subcategory_popularity_pkey" PRIMARY KEY ("brand_id","subcategory_id","region")
);

-- CreateIndex
CREATE INDEX "brand_category_popularity_category_id_region_idx" ON "brand_category_popularity"("category_id", "region");

-- CreateIndex
CREATE INDEX "brand_subcategory_popularity_subcategory_id_region_idx" ON "brand_subcategory_popularity"("subcategory_id", "region");

-- AddForeignKey
ALTER TABLE "brand_category_popularity" ADD CONSTRAINT "brand_category_popularity_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_category_popularity" ADD CONSTRAINT "brand_category_popularity_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_subcategory_popularity" ADD CONSTRAINT "brand_subcategory_popularity_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_subcategory_popularity" ADD CONSTRAINT "brand_subcategory_popularity_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

