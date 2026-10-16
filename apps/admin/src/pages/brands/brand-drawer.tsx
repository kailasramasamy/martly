import { useMemo, useState } from "react";
import { useList, useGetIdentity } from "@refinedev/core";
import { canEditCatalogRecord, type PermissionSubject } from "@martly/shared/permissions";
import { listingLabel, listingState, type ListingState, type VariantListing } from "@martly/shared/listing";
import { EditButton } from "@refinedev/antd";
import { Drawer, Input, List, Tag, Space, Avatar, Typography, Flex, Empty, Tooltip } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { Link } from "react-router";

const { Text, Title } = Typography;

export interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  themeColor: string | null;
  themeColorSecondary: string | null;
  /** null = master brand; set = the organization's own local brand */
  organizationId: string | null;
  _count: { products: number };
}

interface BrandProduct {
  id: string;
  name: string;
  imageUrl?: string;
  isActive: boolean;
  organizationId: string | null;
  subcategory?: { id: string; name: string; category: { id: string; name: string } };
  variants?: { id: string; name: string; mrp?: number }[];
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

interface Pill { id: string; name: string; count: number }

function countPills(items: (Omit<Pill, "count"> | undefined)[]): Pill[] {
  const map = new Map<string, Pill>();
  for (const item of items) {
    if (!item) continue;
    const pill = map.get(item.id) ?? { ...item, count: 0 };
    pill.count++;
    map.set(item.id, pill);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

const PillRow = ({ pills, total, selected, onSelect }: {
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

/** Origin (master catalog or the organization's own) and listing status (for the member's only store, or how many of their stores list it) */
const ProductItem = ({ product, storeId }: { product: BrandProduct; storeId: string | null }) => {
  const listings = product.storeProducts ?? [];
  const state = listingState(listings, storeId);
  return (
    <List.Item
      extra={
        <Space size={4}>
          {product.organizationId ? <Tag color="purple">Local</Tag> : <Tag color="blue">Master</Tag>}
          <Tooltip title={listings.length > 0 ? <span style={{ whiteSpace: "pre-line" }}>{storeBreakdown(listings)}</span> : undefined}>
            <Tag color={LISTING_COLORS[state.kind]}>{listingLabel(state)}</Tag>
          </Tooltip>
        </Space>
      }
    >
      <List.Item.Meta
        avatar={<Avatar shape="square" size={40} src={product.imageUrl}>{product.name[0]}</Avatar>}
        title={<Link to={`/products/show/${product.id}`}>{product.name}</Link>}
        description={
          <Space size={4} wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>{product.subcategory?.name}</Text>
            {product.variants?.map((v) => (
              <Tag key={v.id} style={{ marginInlineEnd: 0 }}>
                {v.name}
                {v.mrp != null && ` · ₹${Number(v.mrp).toLocaleString("en-IN")}`}
              </Tag>
            ))}
          </Space>
        }
      />
    </List.Item>
  );
};

// Logos vary from square marks to wide wordmarks: fit them uncropped in a 2:1 box
export const BrandLogo = ({ brand, height }: { brand: Pick<BrandRecord, "name" | "imageUrl">; height: number }) =>
  brand.imageUrl ? (
    <img
      src={brand.imageUrl}
      alt={brand.name}
      style={{ width: height * 2, height, objectFit: "contain", flexShrink: 0 }}
    />
  ) : (
    <Avatar shape="square" size={height} style={{ width: height * 2, flexShrink: 0 }}>{brand.name[0]}</Avatar>
  );

export const BrandScopeTag = ({ brand }: { brand: BrandRecord }) =>
  brand.organizationId ? <Tag color="purple">Local</Tag> : <Tag color="blue">Master</Tag>;

/** Master brands belong to the platform admin; local brands to members of their organization with the brands permission */
export function useCanEditBrand() {
  const { data: identity } = useGetIdentity<PermissionSubject & { organizationId?: string }>();
  return (brand: BrandRecord) => canEditCatalogRecord(identity, "brands", brand);
}

const BrandHeader = ({ brand }: { brand: BrandRecord }) => {
  const canEdit = useCanEditBrand();
  return (
  <Flex gap={16} align="center">
    <BrandLogo brand={brand} height={64} />
    <div style={{ flex: 1 }}>
      <Title level={4} style={{ margin: 0 }}>{brand.name} <BrandScopeTag brand={brand} /></Title>
      <Text type="secondary">{brand.slug} · {brand._count.products} products</Text>
      {brand.themeColor && (
        <Flex gap={4} style={{ marginTop: 4 }}>
          {[brand.themeColor, brand.themeColorSecondary].filter(Boolean).map((c) => (
            <span key={c} title={c!} style={{ width: 16, height: 16, borderRadius: 4, background: c!, border: "1px solid #e2e8f0" }} />
          ))}
        </Flex>
      )}
    </div>
    {canEdit(brand) && <EditButton size="small" recordItemId={brand.id} resource="brands" />}
  </Flex>
  );
};

export const BrandDrawer = ({ brand, open, onClose }: { brand: BrandRecord | null; open: boolean; onClose: () => void }) => {
  const { data: identity } = useGetIdentity<{ stores?: { id: string }[] }>();
  // Members of one store see that store's state; owners see how many of their stores list each product
  const singleStoreId = identity?.stores?.length === 1 ? identity.stores[0].id : null;
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);

  const { data, isLoading } = useList<BrandProduct>({
    resource: "products",
    pagination: { current: 1, pageSize: brand?._count.products || 1 },
    filters: [
      { field: "brandId", operator: "eq", value: brand?.id },
      { field: "includeStoreProducts", operator: "eq", value: "true" },
    ],
    queryOptions: { enabled: !!brand },
  });

  const products = useMemo(
    () => [...(data?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );
  const matching = products.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const inCategory = matching.filter((p) => !categoryId || p.subcategory?.category.id === categoryId);
  const visible = inCategory.filter((p) => !subcategoryId || p.subcategory?.id === subcategoryId);

  const reset = () => {
    setQ("");
    selectCategory(null);
  };

  const selectCategory = (id: string | null) => {
    setCategoryId(id);
    setSubcategoryId(null);
  };

  return (
    <Drawer open={open} onClose={onClose} width={640} afterOpenChange={(open) => !open && reset()} title={brand && <BrandHeader brand={brand} />}>
      <Flex vertical gap={12}>
        <Input placeholder="Search products..." prefix={<SearchOutlined />} allowClear value={q} onChange={(e) => setQ(e.target.value)} />
        <PillRow pills={countPills(matching.map((p) => p.subcategory?.category))} total={matching.length} selected={categoryId} onSelect={selectCategory} />
        {categoryId && (
          <PillRow pills={countPills(inCategory.map((p) => p.subcategory))} total={inCategory.length} selected={subcategoryId} onSelect={setSubcategoryId} />
        )}
        <List
          loading={isLoading}
          dataSource={visible}
          rowKey="id"
          locale={{ emptyText: <Empty description="No products" /> }}
          renderItem={(p) => <ProductItem product={p} storeId={singleStoreId} />}
        />
      </Flex>
    </Drawer>
  );
};
