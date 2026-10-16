import { useEffect } from "react";
import { Button, Card, Form, Table } from "antd";
import type { CatalogDraftSizeInput } from "@martly/shared/schemas";
import type { CatalogDraftDetail, CatalogDraftSize } from "@martly/shared/types";
import { SizeFields } from "./size-fields";

const inr = (n: number | null) => (n === null ? "-" : `₹${n.toLocaleString("en-IN")}`);

const COLUMNS = [
  { title: "Size", dataIndex: "name" },
  { title: "MRP", dataIndex: "mrp", render: inr },
  { title: "Price here", dataIndex: "price", render: (p: number | null) => (p === null ? "Not listed here" : inr(p)) },
  { title: "Stock", dataIndex: "stock", render: (s: number | null) => s ?? "-" },
];

/** The live product's sizes, and more added straight into the draft store's listing */
export function SizesCard({ draft, busy, onAdd }: { draft: CatalogDraftDetail; busy: boolean; onAdd: (sizes: CatalogDraftSizeInput[]) => void }) {
  const [form] = Form.useForm<{ sizes: CatalogDraftSizeInput[] }>();
  const sizes = Form.useWatch("sizes", form) ?? [];
  // Clear the rows once they show up as saved sizes; a refused save keeps them for fixing
  useEffect(() => form.resetFields(), [draft.sizes.length, form]);
  return (
    <Card title="Sizes">
      <Table<CatalogDraftSize> rowKey="id" size="small" pagination={false} columns={COLUMNS} dataSource={draft.sizes} style={{ marginBottom: 16 }} />
      <Form form={form} layout="vertical" onFinish={(v) => onAdd(v.sizes)}>
        <SizeFields name="sizes" unitType={draft.label?.unitType} />
        {sizes.length > 0 && <Button type="primary" htmlType="submit" loading={busy} style={{ marginLeft: 8 }}>Save sizes</Button>}
      </Form>
    </Card>
  );
}
