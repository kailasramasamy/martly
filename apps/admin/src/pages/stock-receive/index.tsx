import { useMemo, useState } from "react";
import { Card, Select, Table, InputNumber, Input, Button, Space, Typography, message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";

import { axiosInstance } from "../../providers/data-provider";
import { StoreSelect } from "../../components/StoreSelect";
import { ReadableSection } from "../../components/ReadableSection";

interface StoreProductOption {
  id: string;
  stock: number;
  product: { name: string };
  variant?: { name?: string } | null;
}

interface Line {
  sp: StoreProductOption;
  quantity: number | null;
}

const labelOf = (sp: StoreProductOption) => [sp.product?.name, sp.variant?.name].filter(Boolean).join(" — ");

export const StockReceivePage = () => {
  const [storeId, setStoreId] = useState<string>();
  const [results, setResults] = useState<StoreProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const searchProducts = async (q: string) => {
    if (!storeId || q.trim().length < 2) return setResults([]);
    setSearching(true);
    try {
      const res = await axiosInstance.get("/store-products", { params: { storeId, q: q.trim(), pageSize: 20 } });
      setResults(res.data.data);
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const addLine = (id: string) => {
    const sp = results.find((r) => r.id === id);
    if (sp && !lines.some((l) => l.sp.id === id)) setLines((ls) => [...ls, { sp, quantity: null }]);
  };

  const setQty = (id: string, quantity: number | null) =>
    setLines((ls) => ls.map((l) => (l.sp.id === id ? { ...l, quantity } : l)));

  const valid = useMemo(() => lines.length > 0 && lines.every((l) => (l.quantity ?? 0) > 0), [lines]);

  const submit = async () => {
    setSaving(true);
    try {
      await axiosInstance.post("/stock/receive", {
        storeId,
        lines: lines.map((l) => ({ storeProductId: l.sp.id, quantity: l.quantity })),
        note: note.trim() || undefined,
      });
      message.success("Stock received");
      setLines([]);
      setNote("");
      setResults([]);
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to receive stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3}>Receive Stock</Typography.Title>
      <ReadableSection>
        <Card style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <StoreSelect
              value={storeId}
              style={{ width: "100%", maxWidth: 360 }}
              onChange={(v) => {
                setStoreId(v);
                setLines([]);
                setResults([]);
              }}
            />
            <Select
              showSearch
              filterOption={false}
              disabled={!storeId}
              loading={searching}
              value={null}
              placeholder="Search products to add (min 2 characters)"
              style={{ width: "100%", maxWidth: 560 }}
              onSearch={searchProducts}
              onChange={addLine}
              notFoundContent={searching ? "Searching..." : "No products"}
              options={results.map((sp) => ({ value: sp.id, label: `${labelOf(sp)} (stock ${sp.stock})` }))}
            />
          </Space>
        </Card>

        <Card title={`Items (${lines.length})`}>
          <Table
            rowKey={(l) => l.sp.id}
            size="small"
            pagination={false}
            dataSource={lines}
            locale={{ emptyText: "Search and add the products you received" }}
            columns={[
              { title: "Product", render: (_: unknown, l: Line) => labelOf(l.sp) },
              { title: "Current", width: 90, align: "right" as const, render: (_: unknown, l: Line) => l.sp.stock },
              {
                title: "Received",
                width: 140,
                render: (_: unknown, l: Line) => (
                  <InputNumber min={1} precision={0} value={l.quantity} onChange={(v) => setQty(l.sp.id, v)} style={{ width: 110 }} />
                ),
              },
              {
                title: "",
                width: 50,
                render: (_: unknown, l: Line) => (
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setLines((ls) => ls.filter((x) => x.sp.id !== l.sp.id))} />
                ),
              },
            ]}
          />
          <Input.TextArea
            rows={2}
            maxLength={300}
            placeholder="Note (e.g. supplier, invoice number)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ marginTop: 16 }}
          />
          <Button type="primary" disabled={!valid} loading={saving} onClick={submit} style={{ marginTop: 16 }}>
            Receive stock
          </Button>
        </Card>
      </ReadableSection>
    </div>
  );
};
