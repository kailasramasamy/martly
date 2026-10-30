CREATE TABLE "brand_region_popularity" (
    "brand_id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "popularity" INTEGER NOT NULL,

    CONSTRAINT "brand_region_popularity_pkey" PRIMARY KEY ("brand_id","region")
);

ALTER TABLE "brand_region_popularity" ADD CONSTRAINT "brand_region_popularity_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
