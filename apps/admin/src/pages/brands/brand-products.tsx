import { listingLabel, listingState, type ListingState, type VariantListing } from "@martly/shared/listing";
import { Card, Tag, Space, Typography, Flex, Tooltip, Avatar } from "antd";
import { Link } from "react-router";

const { Text } = Typography;

export interface BrandProduct {
  id: string;
  name: string;
  imageUrl?: string;
  isActive: boolean;
  organizationId: string | null;
  subcategory?: { id: string; name: string; category: { id: string; name: string } };
  variants?: { id: string; name: string; mrp?: number; unitType: string; unitValue: string }[];
  storeProducts?: (VariantListing & { store: { id: string; name: string } })[];
}

const LISTING_COLORS: Record<ListingState["kind"], string> = {
  listed: "green", outOfStock: "gold", hidden: "default", notListed: "default", stores: "cyan",
};

/** Store-by-store listing state, shown on hover of the summary tag */
function storeBreakdown(listings: NonNullable<BrandProduct["storeProducts"]>) {
  const stores = new Map(listings.map((l) => [l.store.id, l.store.name]));
  return [...stores].map(([id, name]) => `${name}: ${listingLabel(listingState(listings, id))}`).join("\n");
}

type Variant = NonNullable<BrandProduct["variants"]>[number];

// Formatted units (kg, L) in grams / millilitres, so 500 g sorts before 1 kg
const UNIT_FACTOR: Record<string, number> = { kg: 1000, L: 1000 };
const packSize = (v: Variant) => Number(v.unitValue) * (UNIT_FACTOR[v.unitType] ?? 1);

/** Smallest pack first; same size by MRP */
const bySize = (a: Variant, b: Variant) => packSize(a) - packSize(b) || Number(a.mrp ?? 0) - Number(b.mrp ?? 0);

export interface Pill { id: string; name: string; count: number }

export function countPills(items: (Omit<Pill, "count"> | undefined)[]): Pill[] {
  const map = new Map<string, Pill>();
  for (const item of items) {
    if (!item) continue;
    const pill = map.get(item.id) ?? { ...item, count: 0 };
    pill.count++;
    map.set(item.id, pill);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export const PillRow = ({ pills, total, selected, onSelect }: {
  pills: Pill[]; total: number; selected: string | null; onSelect: (id: string | null) => void;
}) => (
  <Flex wrap gap={6}>
    <Tag.CheckableTag checked={!selected} onChange={() => onSelect(null)}>All ({total})</Tag.CheckableTag>
    {pills.map((p) => (
      <Tag.CheckableTag key={p.id} checked={selected === p.id} onChange={() => onSelect(selected === p.id ? null : p.id)}>
        {p.name} ({p.count})
      </Tag.CheckableTag>
    ))}
  </Flex>
);

/** Photo, sizes with MRP, origin (master or the organization's own) and listing status (for the member's only store, or how many of their stores list it) */
export const ProductCard = ({ product, storeId }: { product: BrandProduct; storeId: string | null }) => {
  const listings = product.storeProducts ?? [];
  const state = listingState(listings, storeId);
  return (
    <Link to={`/products/show/${product.id}`}>
      <Card
        hoverable
        size="small"
        style={{ height: "100%" }}
        cover={product.imageUrl
          ? <img src={product.imageUrl} alt={product.name} style={{ height: 160, objectFit: "contain", padding: 8, background: "#fff" }} />
          : <Avatar shape="square" style={{ height: 160, fontSize: 40 }}>{product.name[0]}</Avatar>}
      >
        <Text strong style={{ display: "block", fontSize: 13 }}>{product.name}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{product.subcategory?.name}</Text>
        <Space size={4} wrap style={{ marginTop: 6 }}>
          {[...(product.variants ?? [])].sort(bySize).map((v) => (
            <Tag key={v.id} style={{ marginInlineEnd: 0 }}>
              {v.name}
              {v.mrp != null && ` · ₹${Number(v.mrp).toLocaleString("en-IN")}`}
            </Tag>
          ))}
        </Space>
        <Space size={4} style={{ marginTop: 6 }}>
          {product.organizationId ? <Tag color="purple">Local</Tag> : <Tag color="blue">Master</Tag>}
          <Tooltip title={listings.length > 0 ? <span style={{ whiteSpace: "pre-line" }}>{storeBreakdown(listings)}</span> : undefined}>
            <Tag color={LISTING_COLORS[state.kind]}>{listingLabel(state)}</Tag>
          </Tooltip>
        </Space>
      </Card>
    </Link>
  );
};
