import { Button, DatePicker, Select, Space, Tabs } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { DebouncedSearch } from "../../components/DebouncedSearch";

export interface LedgerFilters {
  storeId?: string;
  group: string;
  state?: string;
  range: [Dayjs, Dayjs] | null;
  q?: string;
}

export const EMPTY_FILTERS: LedgerFilters = { group: "ALL", range: null };

const GROUP_TABS = [
  { key: "ALL", label: "All" },
  { key: "SALES", label: "Sales" },
  { key: "REFUNDS", label: "Refunds" },
  { key: "FEES", label: "Fees" },
  { key: "PAYOUTS", label: "Payouts" },
];

const STATE_OPTIONS = [
  { value: "ON_HOLD", label: "On hold" },
  { value: "AVAILABLE", label: "Available" },
  { value: "SETTLED", label: "Settled" },
];

/** Query params shared by the list and the CSV export */
export function ledgerParams(f: LedgerFilters, organizationId?: string) {
  return {
    organizationId,
    storeId: f.storeId,
    group: f.group === "ALL" ? undefined : f.group,
    state: f.state,
    from: f.range?.[0].format("YYYY-MM-DD"),
    to: f.range?.[1].format("YYYY-MM-DD"),
    q: f.q || undefined,
  };
}

interface Props {
  filters: LedgerFilters;
  stores: { value: string; label: string }[];
  exporting: boolean;
  onChange: (next: LedgerFilters) => void;
  onExport: () => void;
}

export function LedgerFilterBar({ filters, stores, exporting, onChange, onExport }: Props) {
  const set = (patch: Partial<LedgerFilters>) => onChange({ ...filters, ...patch });
  return (
    <>
      <Tabs activeKey={filters.group} onChange={(group) => set({ group })} items={GROUP_TABS} style={{ marginBottom: 0 }} />
      <Space wrap style={{ margin: "8px 0 16px" }}>
        <Select allowClear showSearch optionFilterProp="label" placeholder="All stores" style={{ width: 200 }} options={stores} value={filters.storeId} onChange={(storeId) => set({ storeId })} />
        <Select allowClear placeholder="Any state" style={{ width: 150 }} options={STATE_OPTIONS} value={filters.state} onChange={(state) => set({ state })} />
        <DatePicker.RangePicker value={filters.range} onChange={(range) => set({ range: range as LedgerFilters["range"] })} />
        <DebouncedSearch placeholder="Search memo or order" style={{ width: 240 }} onSearch={(q) => set({ q })} />
        <Button icon={<DownloadOutlined />} loading={exporting} onClick={onExport}>Export CSV</Button>
      </Space>
    </>
  );
}
