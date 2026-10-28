import { useEffect, useState } from "react";
import { Avatar, Button, Card, Popconfirm, Segmented, Space, Table, Typography } from "antd";
import type { StockCheckBrand, StockCheckDepartment } from "@martly/shared/types";
import { UNBRANDED, type CarryState } from "@martly/shared/schemas";
import { DebouncedSearch } from "../../components/DebouncedSearch";
import { ReadableSection } from "../../components/ReadableSection";
import { count, useStockGet, type StockCheckActions } from "./api";
import { Counts, Thumbs } from "./cells";

export type BrandTab = CarryState | "all";

interface Props {
  storeId: string;
  initialTab?: BrandTab;
  department: StockCheckDepartment;
  version: number;
  actions: StockCheckActions;
  onSizes: (brand: StockCheckBrand, tab: BrandTab) => void;
}

const PAGE_SIZE = 30;

const TABS: { label: string; value: BrandTab }[] = [
  { label: "To confirm", value: "unchecked" }, { label: "Carried", value: "carried" }, { label: "Not sold", value: "notCarried" }, { label: "All", value: "all" },
];

const EMPTY: Record<BrandTab, string> = {
  unchecked: "Every brand here is confirmed. Brands you said no to are under Not sold",
  carried: "Nothing carried here yet",
  notCarried: "Nothing ruled out here",
  all: "No brands found",
};

/** Per tab: the one answer that changes a brand (or a picked set), and whether a brand has anything it would touch */
const ANSWERS: Record<BrandTab, { yes?: string; no?: string; has: (b: StockCheckBrand) => boolean }> = {
  unchecked: { yes: "Yes", no: "No", has: (b) => b.unchecked > 0 },
  all: { yes: "Yes", no: "No", has: (b) => b.unchecked > 0 },
  carried: { no: "Stop selling", has: (b) => b.carried > 0 },
  notCarried: { yes: "Sell again", has: (b) => b.notCarried > 0 },
};

const Answers = ({ tab, disabled, size, onDecide }: { tab: BrandTab; disabled?: boolean; size?: "small"; onDecide: (carried: boolean) => void }) => {
  const a = ANSWERS[tab];
  return (
    <>
      {a.yes && <Button size={size} type="primary" disabled={disabled} onClick={() => onDecide(true)}>{a.yes}</Button>}
      {a.no && <Button size={size} danger disabled={disabled} onClick={() => onDecide(false)}>{a.no}</Button>}
    </>
  );
};

const BrandCell = ({ brand }: { brand: StockCheckBrand }) => (
  <Space>
    <Avatar shape="square" src={brand.imageUrl && <img src={brand.imageUrl} alt="" style={{ objectFit: "contain" }} />}>{brand.name[0]}</Avatar>
    <Thumbs images={brand.sampleImages} />
    <Typography.Text strong>{brand.id === UNBRANDED ? "Unbranded" : brand.name}</Typography.Text>
  </Space>
);

/** The picked department's brands: say yes or no to a whole brand, or go down to its sizes */
export const BrandsTable = ({ storeId, initialTab = "unchecked", department, version, actions, onSizes }: Props) => {
  const [status, setStatus] = useState<BrandTab>(initialTab);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const { data, meta, loading } = useStockGet<StockCheckBrand[]>("brands", { storeId, departmentId: department.id, status, q: q || undefined, page, pageSize: PAGE_SIZE }, version);

  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [department.id, status, q]);

  // Carried and Not sold flip what's there; the others answer only what's still to confirm
  const only: CarryState = status === "carried" || status === "notCarried" ? status : "unchecked";
  const scopes = (ids: string[]) => ids.map((brandId) => ({ departmentId: department.id, brandId, only }));
  const decideSelected = async (carried: boolean) => {
    if (await actions.decide(scopes(selected), carried)) setSelected([]);
  };

  return (
    <>
      <ReadableSection style={{ marginBottom: 12 }}>
        <Card size="small">
          <Space wrap>
            <Segmented options={TABS} value={status} onChange={(v) => setStatus(v as BrandTab)} />
            <DebouncedSearch placeholder="Search brands" onSearch={setQ} style={{ width: 240 }} />
            {status === "unchecked" && (
              <>
                <Typography.Text type="secondary">Rest of {department.name}:</Typography.Text>
                <Button size="small" disabled={department.unchecked === 0} onClick={() => actions.decide([{ departmentId: department.id }], true)}>Yes</Button>
                <Popconfirm title={`Hide ${count(department.unchecked)} ${department.name} products?`} okText="Hide" okButtonProps={{ danger: true }} disabled={department.unchecked === 0} onConfirm={() => actions.decide([{ departmentId: department.id }], false)}>
                  <Button size="small" danger disabled={department.unchecked === 0}>No</Button>
                </Popconfirm>
              </>
            )}
          </Space>
          {selected.length > 0 && (
            <Space style={{ marginTop: 12 }}>
              <Typography.Text strong>{selected.length} selected</Typography.Text>
              <Answers tab={status} onDecide={decideSelected} />
              <Button type="link" onClick={() => setSelected([])}>Clear</Button>
            </Space>
          )}
        </Card>
      </ReadableSection>
      <Table<StockCheckBrand>
        rowKey="id"
        size="small"
        dataSource={data ?? []}
        loading={loading}
        locale={{ emptyText: EMPTY[status] }}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as string[]) }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total: meta?.total ?? 0, showSizeChanger: false, onChange: setPage }}
        columns={[
          { title: "Brand", render: (_, b) => <BrandCell brand={b} /> },
          { title: "Products", width: 360, render: (_, b) => <Counts c={b} /> },
          {
            title: "Actions",
            width: 240,
            render: (_, b) => (
              <Space size={4}>
                <Answers tab={status} size="small" disabled={!ANSWERS[status].has(b)} onDecide={(carried) => actions.decide(scopes([b.id]), carried)} />
                <Button size="small" onClick={() => onSizes(b, status)}>Sizes →</Button>
              </Space>
            ),
          },
        ]}
      />
    </>
  );
};
