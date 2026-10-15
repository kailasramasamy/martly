import { formatINR } from "../ui/tokens";

export interface FeaturedStoreProduct {
  id: string;
  price: string | number;
  stock: number;
  reservedStock: number;
  isActive: boolean;
  isFeatured: boolean;
  store: { id: string; name: string };
  product: { id: string; name: string; imageUrl: string | null; brand: { name: string } | null };
  variant: { id: string; name: string };
}

export function describeListing(sp: FeaturedStoreProduct, showStore: boolean): string {
  const parts = [sp.variant.name, formatINR(Number(sp.price), { decimals: true }), `${sp.stock - sp.reservedStock} in stock`];
  if (showStore) parts.push(sp.store.name);
  return parts.join(" · ");
}
