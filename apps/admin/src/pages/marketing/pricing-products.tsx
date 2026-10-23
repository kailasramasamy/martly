import { useState } from "react";
import { Button, Card, Input, InputNumber, Switch, Table, Tag } from "antd";
import { BannerPlacementLabels, type BannerPlacement } from "@martly/shared/constants";
import type { AdProduct } from "./types";
import { PlacementPreviewModal, type PreviewTarget } from "../brand-campaigns/placements/PlacementPreviewModal";

type Patch = (id: string, change: Partial<AdProduct>) => void;

interface TableProps {
  products: AdProduct[];
  patch: Patch;
}

const rupeeInput = (value: number, onChange: (v: number) => void) => (
  <InputNumber prefix={"₹"} min={0} value={value} onChange={(v) => onChange(v ?? 0)} style={{ width: 110 }} />
);

const yearlyPriceInput = (value: number | null, onChange: (v: number | null) => void) => (
  <InputNumber prefix={"₹"} min={0} value={value} placeholder="None" onChange={onChange} style={{ width: 110 }} />
);

const countInput = (value: number, onChange: (v: number) => void, min = 0) => (
  <InputNumber min={min} precision={0} value={value} onChange={(v) => onChange(v ?? min)} style={{ width: 80 }} />
);

const textColumns = (patch: Patch) => [
  { title: "Name", dataIndex: "name", width: 160, render: (v: string, r: AdProduct) => <Input value={v} onChange={(e) => patch(r.id, { name: e.target.value })} /> },
  { title: "Description", dataIndex: "description", width: 240, render: (v: string | null, r: AdProduct) => <Input value={v ?? ""} onChange={(e) => patch(r.id, { description: e.target.value || null })} /> },
];

const onSaleColumn = (patch: Patch) => ({
  title: "On sale",
  dataIndex: "isActive",
  width: 80,
  render: (v: boolean, r: AdProduct) => <Switch checked={v} onChange={(c) => patch(r.id, { isActive: c })} />,
});

export function StorePlansCard({ products, patch }: TableProps) {
  const columns = [
    ...textColumns(patch),
    { title: "Price / month", dataIndex: "price", width: 130, render: (v: number, r: AdProduct) => rupeeInput(v, (price) => patch(r.id, { price })) },
    { title: "Price / year", dataIndex: "yearlyPrice", width: 130, render: (v: number | null, r: AdProduct) => yearlyPriceInput(v, (yearlyPrice) => patch(r.id, { yearlyPrice })) },
    { title: "Promotions / month", dataIndex: "promotionCredits", width: 130, render: (v: number, r: AdProduct) => countInput(v, (n) => patch(r.id, { promotionCredits: n })) },
    { title: "AI images / month", dataIndex: "aiImagesPerMonth", width: 130, render: (v: number, r: AdProduct) => countInput(v, (n) => patch(r.id, { aiImagesPerMonth: n })) },
    { title: "Push included", dataIndex: "pushIncluded", width: 100, render: (v: boolean, r: AdProduct) => <Switch checked={v} onChange={(c) => patch(r.id, { pushIncluded: c })} /> },
    onSaleColumn(patch),
  ];
  return (
    <Card title="Store plans" size="small" style={{ marginBottom: 16 }}>
      <Table size="small" rowKey="id" pagination={false} dataSource={products} columns={columns} scroll={{ x: 1230 }} />
    </Card>
  );
}

export function TopupCard({ products, patch }: TableProps) {
  const columns = [
    { title: "Price", dataIndex: "price", width: 130, render: (v: number, r: AdProduct) => rupeeInput(v, (price) => patch(r.id, { price })) },
    { title: "Promotions per purchase", dataIndex: "promotionCredits", width: 180, render: (v: number, r: AdProduct) => countInput(v, (n) => patch(r.id, { promotionCredits: n }), 1) },
    onSaleColumn(patch),
  ];
  return (
    <Card title="Extra promotion" size="small" style={{ marginBottom: 16 }}>
      <Table size="small" rowKey="id" pagination={false} dataSource={products} columns={columns} />
    </Card>
  );
}

export function ImagePacksCard({ products, patch }: TableProps) {
  const columns = [
    ...textColumns(patch),
    { title: "Price", dataIndex: "price", width: 130, render: (v: number, r: AdProduct) => rupeeInput(v, (price) => patch(r.id, { price })) },
    { title: "Images per pack", dataIndex: "aiImageCredits", width: 140, render: (v: number, r: AdProduct) => countInput(v, (n) => patch(r.id, { aiImageCredits: n }), 1) },
    { title: "Sort order", dataIndex: "sortOrder", width: 100, render: (v: number, r: AdProduct) => countInput(v, (n) => patch(r.id, { sortOrder: n })) },
    onSaleColumn(patch),
  ];
  return (
    <Card title="AI image packs" size="small" style={{ marginBottom: 16 }}>
      <Table size="small" rowKey="id" pagination={false} dataSource={products} columns={columns} scroll={{ x: 900 }} />
    </Card>
  );
}

export function BrandPackagesCard({ products, patch }: TableProps) {
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const columns = [
    ...textColumns(patch),
    { title: "Price", dataIndex: "price", width: 130, render: (v: number, r: AdProduct) => rupeeInput(v, (price) => patch(r.id, { price })) },
    { title: "Days", dataIndex: "durationDays", width: 90, render: (v: number, r: AdProduct) => countInput(v, (n) => patch(r.id, { durationDays: n }), 1) },
    {
      title: "Placement",
      dataIndex: "placement",
      width: 150,
      render: (v: string | null) => (v ? <Tag>{BannerPlacementLabels[v as BannerPlacement] ?? v}</Tag> : "—"),
    },
    {
      title: "Views per unit",
      dataIndex: "viewsPerUnit",
      width: 120,
      render: (v: number | null, r: AdProduct) =>
        r.kind === "BRAND_CPM" ? countInput(v ?? 1000, (n) => patch(r.id, { viewsPerUnit: n }), 1) : "—",
    },
    {
      title: "Where it shows",
      width: 130,
      render: (_: unknown, r: AdProduct) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setPreview({ name: r.name, kind: r.kind, placement: r.placement })}>Where it shows</Button>
      ),
    },
    onSaleColumn(patch),
  ];
  return (
    <Card title="Brand packages" size="small" style={{ marginBottom: 16 }}>
      <Table size="small" rowKey="id" pagination={false} dataSource={products} columns={columns} scroll={{ x: 1130 }} />
      <PlacementPreviewModal target={preview} onClose={() => setPreview(null)} />
    </Card>
  );
}
