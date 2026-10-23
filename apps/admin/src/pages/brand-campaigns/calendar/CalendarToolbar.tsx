import { Button, Segmented, Select, Space, Switch, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import type { Campaign } from "../types";
import { campaignColor } from "./package-colors";
import { ALL_TYPES } from "./use-calendar-data";

export type CalendarView = "month" | "timeline";

interface Props {
  month: Dayjs;
  view: CalendarView;
  onView: (v: CalendarView) => void;
  onShift: (delta: number) => void;
  onToday: () => void;
  type: string;
  typeNames: string[];
  onType: (t: string) => void;
  showClosed: boolean;
  onShowClosed: (v: boolean) => void;
}

export function CalendarToolbar(p: Props) {
  const typeOptions = [{ value: ALL_TYPES, label: "All types" }, ...p.typeNames.map((n) => ({ value: n, label: n }))];
  return (
    <Space wrap size="middle" style={{ marginBottom: 12 }}>
      <Space>
        <Button icon={<LeftOutlined />} onClick={() => p.onShift(-1)} aria-label="Previous month" />
        <Typography.Text strong style={{ display: "inline-block", minWidth: 120, textAlign: "center" }}>{p.month.format("MMMM YYYY")}</Typography.Text>
        <Button icon={<RightOutlined />} onClick={() => p.onShift(1)} aria-label="Next month" />
        <Button onClick={p.onToday}>Today</Button>
      </Space>
      <Segmented<CalendarView> value={p.view} onChange={p.onView} options={[{ value: "month", label: "Month" }, { value: "timeline", label: "Timeline" }]} />
      <Select value={p.type} onChange={p.onType} options={typeOptions} style={{ minWidth: 180 }} />
      <Space><Switch checked={p.showClosed} onChange={p.onShowClosed} />Show ended &amp; cancelled</Space>
    </Space>
  );
}

/** One dot per package type present in the filtered campaigns */
export function Legend({ campaigns }: { campaigns: Campaign[] }) {
  const entries = [...new Map(campaigns.map((c) => [c.product.name, campaignColor(c)]))].sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return null;
  return (
    <Space wrap size={[16, 4]} style={{ marginBottom: 12 }}>
      {entries.map(([name, color]) => (
        <Space key={name} size={6}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: color, display: "inline-block" }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{name}</Typography.Text>
        </Space>
      ))}
    </Space>
  );
}
