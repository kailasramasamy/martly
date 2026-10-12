import { useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import { EditButton } from "@refinedev/antd";
import { Drawer, Input, List, Tag, Space, Avatar, Typography, Flex, Empty } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { Link } from "react-router";
import { ACTIVE_STATUS_CONFIG } from "../../constants/tag-colors";

const { Text, Title } = Typography;

export interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  themeColor: string | null;
  themeColorSecondary: string | null;
  _count: { products: number };
}

interface BrandProduct {
  id: string;
  name: string;
  imageUrl?: string;
  isActive: boolean;
  subcategory?: { id: string; name: string; category: { id: string; name: string } };
  variants?: { id: string; name: string; mrp?: number }[];
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

const ProductItem = ({ product }: { product: BrandProduct }) => {
  const status = ACTIVE_STATUS_CONFIG[String(product.isActive)];
  return (
    <List.Item extra={<Tag color={status.color}>{status.label}</Tag>}>
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

const BrandHeader = ({ brand }: { brand: BrandRecord }) => (
  <Flex gap={16} align="center">
    <Avatar shape="square" size={64} src={brand.imageUrl}>{brand.name[0]}</Avatar>
    <div style={{ flex: 1 }}>
      <Title level={4} style={{ margin: 0 }}>{brand.name}</Title>
      <Text type="secondary">{brand.slug} · {brand._count.products} products</Text>
      {brand.themeColor && (
        <Flex gap={4} style={{ marginTop: 4 }}>
          {[brand.themeColor, brand.themeColorSecondary].filter(Boolean).map((c) => (
            <span key={c} title={c!} style={{ width: 16, height: 16, borderRadius: 4, background: c!, border: "1px solid #e2e8f0" }} />
          ))}
        </Flex>
      )}
    </div>
    <EditButton size="small" recordItemId={brand.id} resource="brands" />
  </Flex>
);

export const BrandDrawer = ({ brand, open, onClose }: { brand: BrandRecord | null; open: boolean; onClose: () => void }) => {
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);

  const { data, isLoading } = useList<BrandProduct>({
    resource: "products",
    pagination: { current: 1, pageSize: brand?._count.products || 1 },
    filters: [{ field: "brandId", operator: "eq", value: brand?.id }],
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
          renderItem={(p) => <ProductItem product={p} />}
        />
      </Flex>
    </Drawer>
  );
};
