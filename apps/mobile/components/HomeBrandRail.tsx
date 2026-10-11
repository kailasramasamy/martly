import { useEffect, useState } from "react";
import { router } from "expo-router";
import { api } from "../lib/api";
import { ShopByBrands } from "./ShopByBrands";
import type { BrandTile } from "../lib/brand-strip";

interface StoreBrand { id: string; name: string; imageUrl: string | null; productCount: number }

// Home "Shop by brands": the store's biggest brands; tapping one opens its brand store
export function HomeBrandRail({ storeId }: { storeId: string }) {
  const [brands, setBrands] = useState<BrandTile[]>([]);

  useEffect(() => {
    api.get<StoreBrand[]>(`/api/v1/brands/store/${storeId}?limit=12`)
      .then((res) => setBrands(res.data.map((b) => ({ id: b.id, name: b.name, imageUrl: b.imageUrl, count: b.productCount }))))
      .catch(() => setBrands([]));
  }, [storeId]);

  return <ShopByBrands brands={brands} selectedId={null} onSelect={(id) => id && router.push(`/brand/${id}`)} />;
}
