import type { ProductListItem } from "../products/types";

export interface CollectionRecord {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  kind: string;
  source: "MANUAL" | "AGENT";
  startsAt: string | null;
  endsAt: string | null;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  _count: { items: number };
}

export interface CollectionDetail extends CollectionRecord {
  items: { productId: string; product: ProductListItem }[];
}
