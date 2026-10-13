import { useEffect, useMemo, useState } from "react";
import { App, Avatar, Button, Card, List, Popconfirm, Select, Space, Tag, Typography } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, ShoppingOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";

export interface CuratedProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  images?: string[];
  brand: { name: string } | null;
  subcategory: { id: string; name: string } | null;
}

interface CuratedItemsCardProps {
  items: Array<{ productId: string; product: CuratedProduct }>;
  value?: string[];
  onChange?: (ids: string[]) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

const thumbOf = (p: CuratedProduct) => p.imageUrl ?? p.images?.[0];

const ProductThumb = ({ product }: { product: CuratedProduct }) => (
  <Avatar shape="square" size={40} src={thumbOf(product)} icon={<ShoppingOutlined />} style={{ borderRadius: 6 }} />
);

const ProductSearch = ({ onPick }: { onPick: (product: CuratedProduct) => void }) => {
  const { message } = App.useApp();
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<CuratedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await axiosInstance.get("/products", { params: { q: search.trim(), pageSize: 20 } });
        setOptions(data.data);
      } catch (err) {
        if (!isAxiosError(err)) throw err;
        message.error(err.response?.data?.message ?? "Product search failed");
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, message]);

  return (
    <Select
      showSearch
      filterOption={false}
      value={null}
      placeholder="Search products to add"
      style={{ width: "100%", marginBottom: 12 }}
      loading={loading}
      onSearch={setSearch}
      onSelect={(id) => {
        const product = options.find((p) => p.id === id);
        if (product) onPick(product);
      }}
      options={options.map((p) => ({
        value: p.id,
        label: (
          <Space>
            <ProductThumb product={p} />
            <span>
              {p.name}
              {p.brand && <Typography.Text type="secondary"> · {p.brand.name}</Typography.Text>}
            </span>
          </Space>
        ),
      }))}
    />
  );
};

export const CuratedItemsCard = ({ items, value = [], onChange }: CuratedItemsCardProps) => {
  const [added, setAdded] = useState<Record<string, CuratedProduct>>({});
  const details = useMemo(() => {
    const map: Record<string, CuratedProduct> = { ...added };
    items.forEach((i) => {
      map[i.product.id] = i.product;
    });
    return map;
  }, [items, added]);

  const aisles = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    value.forEach((id) => {
      const sub = details[id]?.subcategory;
      if (!sub) return;
      counts.set(sub.id, { name: sub.name, count: (counts.get(sub.id)?.count ?? 0) + 1 });
    });
    return [...counts.entries()];
  }, [value, details]);

  const update = (ids: string[]) => onChange?.(ids);

  const move = (index: number, delta: number) => {
    const next = [...value];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    update(next);
  };

  const add = (product: CuratedProduct) => {
    setAdded((prev) => ({ ...prev, [product.id]: product }));
    if (!value.includes(product.id)) update([...value, product.id]);
  };

  const removeAisle = (subId: string) => update(value.filter((id) => details[id]?.subcategory?.id !== subId));

  return (
    <Card title={sectionTitle(<ShoppingOutlined />, "Curated Products")} size="small" style={{ marginTop: 16 }}>
      <Typography.Paragraph strong>
        {value.length} products across {aisles.length} aisles
      </Typography.Paragraph>
      <Space size={[4, 8]} wrap style={{ marginBottom: 12 }}>
        {aisles.map(([subId, { name, count }]) => (
          <Popconfirm
            key={subId}
            title={`Remove all ${count} products in ${name}?`}
            onConfirm={() => removeAisle(subId)}
          >
            <Tag closable onClose={(e) => e.preventDefault()}>
              {name} ({count})
            </Tag>
          </Popconfirm>
        ))}
      </Space>
      <ProductSearch onPick={add} />
      <List
        size="small"
        dataSource={value.map((id) => details[id]).filter(Boolean)}
        renderItem={(product, index) => (
          <List.Item
            actions={[
              <Button key="up" size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => move(index, -1)} />,
              <Button
                key="down"
                size="small"
                icon={<ArrowDownOutlined />}
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
              />,
              <Button
                key="remove"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => update(value.filter((id) => id !== product.id))}
              />,
            ]}
          >
            <List.Item.Meta
              avatar={<ProductThumb product={product} />}
              title={product.name}
              description={
                <Space size={4}>
                  {product.brand?.name}
                  {product.subcategory && <Tag>{product.subcategory.name}</Tag>}
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
};
