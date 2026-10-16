import { Button, Select, Space } from "antd";
import { NO_FILTERS, isFiltered } from "./filters";
import type { BoardFilters, PaymentFilter, ShowFilter } from "./filters";

interface FilterBarProps {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  areas: { pincode: string; count: number }[];
  riders: { id: string; name: string }[];
}

const SHOW_OPTIONS: { label: string; value: ShowFilter }[] = [
  { label: "Everything", value: "all" },
  { label: "Ready to dispatch", value: "ready" },
  { label: "On the road", value: "road" },
  { label: "Ready for pickup", value: "pickupReady" },
  { label: "Still preparing", value: "preparing" },
];

const PAYMENT_OPTIONS: { label: string; value: PaymentFilter }[] = [
  { label: "Any payment", value: "any" },
  { label: "Cash to collect", value: "cash" },
  { label: "Paid", value: "paid" },
];

export function FilterBar({ filters, onChange, areas, riders }: FilterBarProps) {
  const set = (patch: Partial<BoardFilters>) => onChange({ ...filters, ...patch });
  return (
    <Space size={8} wrap style={{ marginBottom: 12 }}>
      <Select<ShowFilter>
        value={filters.show}
        onChange={(show) => set({ show })}
        options={SHOW_OPTIONS}
        style={{ width: 170 }}
      />
      <Select<string>
        value={filters.area ?? undefined}
        onChange={(area) => set({ area: area ?? null })}
        placeholder="All areas"
        allowClear
        options={areas.map((a) => ({ label: `${a.pincode} (${a.count})`, value: a.pincode }))}
        style={{ width: 150 }}
      />
      <Select<PaymentFilter>
        value={filters.payment}
        onChange={(payment) => set({ payment })}
        options={PAYMENT_OPTIONS}
        style={{ width: 160 }}
      />
      <Select<string>
        value={filters.riderId ?? undefined}
        onChange={(riderId) => set({ riderId: riderId ?? null })}
        placeholder="All riders"
        allowClear
        options={riders.map((r) => ({ label: r.name, value: r.id }))}
        style={{ width: 160 }}
      />
      {isFiltered(filters) && <Button onClick={() => onChange(NO_FILTERS)}>Clear</Button>}
    </Space>
  );
}
