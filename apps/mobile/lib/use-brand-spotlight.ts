import { useEffect, useState } from "react";
import type { BrandSpotlight } from "@martly/shared/types";
import { api } from "./api";

/** The brand featured in the tab bar for this store; null while loading or when the store has none */
export function useBrandSpotlight(storeId: string | undefined) {
  const [spotlight, setSpotlight] = useState<BrandSpotlight | null>(null);
  useEffect(() => {
    setSpotlight(null);
    if (!storeId) return;
    let live = true;
    api.get<BrandSpotlight | null>(`/api/v1/brands/store/${storeId}/spotlight`)
      .then((res) => { if (live) setSpotlight(res.data); })
      .catch(() => {});
    return () => { live = false; };
  }, [storeId]);
  return spotlight;
}
