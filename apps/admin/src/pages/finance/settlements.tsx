import { useCallback, useEffect, useState } from "react";
import { App, DatePicker, Empty, Select, Space, Table, Typography } from "antd";
import { SwapOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { SettlementStatusLabels } from "@martly/shared/constants";
import { DebouncedSearch } from "../../components/DebouncedSearch";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { SettlementDrawer } from "./settlement-detail";
import { SettlementStatusTag } from "./settlement-status";
import { errorMessage, formatRupees, useFinanceOrg } from "./utils";
import type { Settlement, SettlementDetail } from "./types";

const PAGE_SIZE = 20;
const day = (v: string | null) => (v ? dayjs(v).format("D MMM YYYY") : "—");
const money = (v: number) => formatRupees(Number(v));
const STATUS_OPTIONS = Object.entries(SettlementStatusLabels).map(([value, label]) => ({ value, label }));

interface Filters {
  status?: string;
  range: [Dayjs, Dayjs] | null;
  q?: string;
}

const columns = [
  { title: "Number", dataIndex: "number" },
  { title: "Period", render: (_: unknown, r: Settlement) => `${day(r.periodStart)} – ${day(r.periodEnd)}` },
  { title: "Credits", dataIndex: "credits", align: "right" as const, render: money },
  { title: "Debits", dataIndex: "debits", align: "right" as const, render: (v: number) => money(Math.abs(Number(v))) },
  { title: "Carried in", dataIndex: "carriedIn", align: "right" as const, render: money },
  { title: "Net", dataIndex: "net", align: "right" as const, render: (v: number) => <strong>{money(v)}</strong> },
  { title: "Status", dataIndex: "status", render: (v: string) => <SettlementStatusTag status={v} /> },
  { title: "UTR", dataIndex: "utr", render: (v: string | null) => v ?? "—" },
  { title: "Paid", dataIndex: "paidAt", render: day },
];

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (next: Filters) => void }) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <Space wrap style={{ marginBottom: 16 }}>
      <Select allowClear placeholder="Any status" style={{ width: 200 }} options={STATUS_OPTIONS} value={filters.status} onChange={(status) => set({ status })} />
      <DatePicker.RangePicker value={filters.range} onChange={(range) => set({ range: range as Filters["range"] })} />
      <DebouncedSearch placeholder="Search number or UTR" style={{ width: 240 }} onSearch={(q) => set({ q })} />
    </Space>
  );
}

function useSettlements(organizationId: string | undefined, enabled: boolean) {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<Settlement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({ range: null });
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<SettlementDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    axiosInstance.get("/ledger/settlements", { params: {
      organizationId, page, pageSize: PAGE_SIZE, status: filters.status, q: filters.q || undefined,
      from: filters.range?.[0].format("YYYY-MM-DD"), to: filters.range?.[1].format("YYYY-MM-DD"),
    } })
      .then((res) => { setRows(res.data.data); setTotal(res.data.meta?.total ?? res.data.data.length); })
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load settlements") }))
      .finally(() => setLoading(false));
  }, [organizationId, enabled, page, filters, notification]);

  const open = useCallback(async (id: string) => {
    setDetailOpen(true);
    setDetail(null);
    try {
      const res = await axiosInstance.get(`/ledger/settlements/${id}`, { params: { organizationId } });
      setDetail(res.data.data);
    } catch (err) {
      setDetailOpen(false);
      notification.error({ message: errorMessage(err, "Could not load the settlement") });
    }
  }, [organizationId, notification]);

  const changeFilters = (next: Filters) => { setFilters(next); setPage(1); };
  return { rows, total, page, setPage, filters, changeFilters, loading, detail, detailOpen, open, close: () => setDetailOpen(false) };
}

export const SettlementsPage = () => {
  const { organizationId, picker, ready } = useFinanceOrg();
  const s = useSettlements(organizationId, ready);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{sectionTitle(<SwapOutlined />, "Settlements")}</h2>
        {picker}
      </div>
      {!ready ? (
        <Empty description={<Typography.Text type="secondary">Choose an organization to see its settlements</Typography.Text>} />
      ) : (
        <>
          <FilterBar filters={s.filters} onChange={s.changeFilters} />
          <Table
            size="small"
            rowKey="id"
            loading={s.loading}
            dataSource={s.rows}
            columns={columns}
            scroll={{ x: 900 }}
            onRow={(r) => ({ onClick: () => void s.open(r.id), style: { cursor: "pointer" } })}
            pagination={{ current: s.page, pageSize: PAGE_SIZE, total: s.total, showSizeChanger: false, onChange: s.setPage }}
          />
        </>
      )}
      {s.detailOpen && <SettlementDrawer detail={s.detail} loading={!s.detail} onClose={s.close} onOpen={(id) => void s.open(id)} />}
    </>
  );
};
