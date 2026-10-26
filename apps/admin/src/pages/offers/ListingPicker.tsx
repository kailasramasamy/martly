import { useEffect, useRef, useState } from "react";
import { Select, Table, Button, Avatar, Space, Spin, Empty, message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";

import { axiosInstance } from "../../providers/data-provider";
import { inr } from "./describe";

export interface PickedListing {
  id: string;
  name: string;
  size: string;
  price: number;
  imageUrl: string | null;
}

interface StoreProductRow {
  id: string;
  price: number | string;
  product: { name: string; imageUrl: string | null };
  variant: { name: string };
}

const toPicked = (sp: StoreProductRow): PickedListing => ({
  id: sp.id, name: sp.product.name, size: sp.variant.name, price: Number(sp.price), imageUrl: sp.product.imageUrl,
});

/** Search the store's listings to add sizes to the offer; the picked ones list below with a remove button */
export const ListingPicker = ({ storeId, picked, onChange }: { storeId?: string; picked: PickedListing[]; onChange: (p: PickedListing[]) => void }) => {
  const [results, setResults] = useState<PickedListing[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestId = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (q: string) => {
    clearTimeout(timer.current);
    if (!q.trim() || !storeId) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const id = ++requestId.current;
      const res = await axiosInstance.get("/store-products", { params: { storeId, q, pageSize: 20 } })
        .catch((err) => { message.error(err.response?.data?.message ?? "Search failed"); return null; });
      if (id !== requestId.current) return;
      setResults(res ? (res.data.data as StoreProductRow[]).map(toPicked) : []);
      setLoading(false);
    }, 300);
  };
  const pickedIds = new Set(picked.map((p) => p.id));
  const add = (id: string | null) => {
    const hit = results.find((r) => r.id === id);
    if (hit && !pickedIds.has(hit.id)) onChange([...picked, hit]);
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Select<string | null>
        showSearch
        value={null}
        disabled={!storeId}
        placeholder={storeId ? "Search products to add" : "Pick a store first"}
        filterOption={false}
        onSearch={search}
        onSelect={add}
        loading={loading}
        suffixIcon={loading ? <Spin size="small" /> : undefined}
        notFoundContent={loading ? <Spin size="small" /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Search to add products" />}
        options={results.map((r) => ({
          value: r.id,
          disabled: pickedIds.has(r.id),
          label: <Space><Avatar shape="square" size="small" src={r.imageUrl} />{r.name} · {r.size} · {inr(r.price)}</Space>,
        }))}
        style={{ width: "100%" }}
      />
      <Table<PickedListing> dataSource={picked} rowKey="id" size="small" pagination={false} locale={{ emptyText: "No products picked yet" }}>
        <Table.Column<PickedListing> title="Product" render={(_, p) => <Space><Avatar shape="square" src={p.imageUrl} />{p.name}</Space>} />
        <Table.Column<PickedListing> dataIndex="size" title="Size" />
        <Table.Column<PickedListing> dataIndex="price" title="Price" align="right" render={(v: number) => inr(v)} />
        <Table.Column<PickedListing> width={60} render={(_, p) => (
          <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Remove ${p.name} ${p.size}`} onClick={() => onChange(picked.filter((x) => x.id !== p.id))} />
        )} />
      </Table>
    </Space>
  );
};
