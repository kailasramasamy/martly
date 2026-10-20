import { useEffect, useState } from "react";
import { App, Button, DatePicker, Select, Space, Table, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { axiosInstance } from "../../../providers/data-provider";
import { DebouncedSearch } from "../../../components/DebouncedSearch";
import { StateTag } from "../ledger";
import { SignedAmount, errorMessage } from "../utils";
import type { LedgerEntry } from "../types";
import { AdjustModal, loadOptions, type Option } from "./adjust-modal";

const PAGE_SIZE = 30;
const MEMO_PREFIX = "Adjustment by Martly: ";

type Adjustment = LedgerEntry & { organizationName: string; createdByName: string | null };
interface Filters { organizationId?: string; range: [Dayjs, Dayjs] | null; q?: string }

const columns = [
  { title: "Date", dataIndex: "createdAt", width: 190, render: (v: string) => dayjs(v).format("D MMM YYYY, h:mm A") },
  { title: "Organization", dataIndex: "organizationName" },
  { title: "Store", dataIndex: "storeName", render: (v: string | null) => v ?? "All stores" },
  { title: "Reason", dataIndex: "memo", render: (v: string | null) => v?.replace(MEMO_PREFIX, "") ?? "—" },
  { title: "Amount", dataIndex: "amount", align: "right" as const, render: (v: number) => <SignedAmount value={Number(v)} /> },
  { title: "Recorded by", dataIndex: "createdByName", render: (v: string | null) => v ?? "—" },
  { title: "State", render: (_: unknown, r: Adjustment) => <StateTag entry={r} /> },
];

function useAdjustments(filters: Filters, page: number, version: number) {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<Adjustment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    axiosInstance.get("/ledger/platform/adjustments", { params: {
      page, pageSize: PAGE_SIZE, organizationId: filters.organizationId, q: filters.q || undefined,
      from: filters.range?.[0].format("YYYY-MM-DD"), to: filters.range?.[1].format("YYYY-MM-DD"),
    } })
      .then((res) => { setRows(res.data.data); setTotal(res.data.meta.total); })
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load adjustments") }))
      .finally(() => setLoading(false));
  }, [filters, page, version, notification]);

  return { rows, total, loading };
}

export function AdjustTab() {
  const [orgs, setOrgs] = useState<Option[]>([]);
  const [filters, setFilters] = useState<Filters>({ range: null });
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState(false);
  const { rows, total, loading } = useAdjustments(filters, page, version);

  useEffect(() => { void loadOptions("/organizations", {}).then(setOrgs); }, []);
  const set = (patch: Partial<Filters>) => { setFilters({ ...filters, ...patch }); setPage(1); };
  const recorded = () => { setOpen(false); setPage(1); setVersion((v) => v + 1); };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Space wrap>
          <Select allowClear showSearch optionFilterProp="label" placeholder="All organizations" style={{ width: 220 }} options={orgs} value={filters.organizationId} onChange={(organizationId) => set({ organizationId })} />
          <DatePicker.RangePicker value={filters.range} onChange={(range) => set({ range: range as Filters["range"] })} />
          <DebouncedSearch placeholder="Search reason" style={{ width: 240 }} onSearch={(q) => set({ q })} />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Record adjustment</Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 1000 }}
        locale={{ emptyText: <Typography.Text type="secondary">No adjustments yet</Typography.Text> }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, onChange: setPage }}
      />
      <AdjustModal open={open} orgs={orgs} onClose={() => setOpen(false)} onRecorded={recorded} />
    </>
  );
}
