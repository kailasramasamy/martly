import { Table, InputNumber, Avatar, Button } from "antd";

import { LineHistory, LineTags } from "./line-history";

export interface CountItem {
  storeProductId: string;
  productName: string;
  variantName?: string | null;
  imageUrl?: string | null;
  countedQty: number | null;
  systemQty?: number | null;
  difference?: number | null;
  recountRequested?: boolean;
  applied?: boolean;
  revisions?: {
    kind: "COUNT" | "RECOUNT" | "CORRECTION";
    qty: number;
    reason: string | null;
    userName: string;
    createdAt: string;
  }[];
}

export interface CountDetail {
  id: string;
  status: "DRAFT" | "SUBMITTED" | "RECOUNT" | "APPROVED" | "REJECTED";
  note?: string | null;
  reviewNote?: string | null;
  recountItems: number;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  store: { id: string; name: string };
  subcategory: { id: string; name: string };
  createdBy: { name: string };
  reviewedBy: { name: string } | null;
  items: CountItem[];
  canSeeSystemStock: boolean;
}

interface Props {
  count: CountDetail;
  draft: Record<string, number | null>;
  entry: boolean;
  onChange: (storeProductId: string, qty: number | null) => void;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  onCorrect?: (item: CountItem) => void;
}

const productCell = (item: CountItem) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <Avatar shape="square" size={36} src={item.imageUrl ?? undefined}>{item.productName[0]}</Avatar>
    <div>
      <div style={{ fontWeight: 500 }}>{item.productName}</div>
      {item.variantName && <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.variantName}</div>}
    </div>
  </div>
);

const systemColumns = [
  { title: "System", dataIndex: "systemQty", width: 100, align: "right" as const },
  {
    title: "Difference",
    dataIndex: "difference",
    width: 110,
    align: "right" as const,
    render: (d?: number | null) =>
      d ? <strong style={{ color: d < 0 ? "#ef4444" : "#f59e0b" }}>{d > 0 ? `+${d}` : d}</strong> : (d ?? "—"),
  },
];

const correctColumn = (onCorrect: (item: CountItem) => void) => ({
  title: "",
  key: "correct",
  width: 90,
  render: (_: unknown, item: CountItem) =>
    !item.applied && item.countedQty !== null && <Button size="small" onClick={() => onCorrect(item)}>Correct</Button>,
});

/** Product and counted columns: a blind number box while entering, the figure once submitted */
function baseColumns(entry: boolean, draft: Props["draft"], onChange: Props["onChange"]) {
  return [
    {
      title: "Product",
      key: "product",
      render: (_: unknown, item: CountItem) => (
        <>
          {productCell(item)}
          <LineTags item={item} />
        </>
      ),
    },
    {
      title: "Counted",
      key: "counted",
      width: 140,
      align: "right" as const,
      render: (_: unknown, item: CountItem) =>
        entry
          ? <InputNumber min={0} precision={0} value={draft[item.storeProductId]} onChange={(v) => onChange(item.storeProductId, v)} style={{ width: 100 }} />
          : item.countedQty ?? "—",
    },
  ];
}

export const CountItemsTable = ({ count, draft, entry, onChange, selectedIds, onSelect, onCorrect }: Props) => {
  const showSystem = !entry && count.canSeeSystemStock && count.status !== "DRAFT";
  const columns = [...baseColumns(entry, draft, onChange), ...(showSystem ? systemColumns : []), ...(onCorrect ? [correctColumn(onCorrect)] : [])];

  return (
    <Table
      rowKey="storeProductId"
      size="small"
      columns={columns}
      dataSource={count.items}
      pagination={{ pageSize: 50, hideOnSinglePage: true, showSizeChanger: false }}
      rowSelection={
        onSelect
          ? {
              selectedRowKeys: selectedIds,
              onChange: (keys) => onSelect(keys as string[]),
              getCheckboxProps: (item) => ({ disabled: item.applied || item.countedQty === null }),
            }
          : undefined
      }
      expandable={{
        rowExpandable: (item) => !!item.revisions?.length,
        expandedRowRender: (item) => <LineHistory item={item} />,
      }}
    />
  );
};
