import { theme } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { Campaign } from "../types";
import { DAY_KEY, isUnconfirmed, monthCells } from "./calendar-data";
import { campaignColor } from "./package-colors";

const MAX_CHIPS = 3;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  month: Dayjs;
  byDay: Map<string, Campaign[]>;
  selected: string;
  onSelect: (key: string) => void;
  onOpen: (c: Campaign) => void;
}

export function MonthView({ month, byDay, selected, onSelect, onOpen }: Props) {
  const { token } = theme.useToken();
  const today = dayjs().format(DAY_KEY);
  const border = `1px solid ${token.colorBorderSecondary}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", border, borderRadius: token.borderRadius, overflow: "hidden" }}>
      {WEEKDAYS.map((d) => (
        <div key={d} style={{ padding: "6px 8px", fontSize: 12, color: token.colorTextSecondary, background: token.colorFillQuaternary, borderBottom: border }}>{d}</div>
      ))}
      {monthCells(month).map((key, i) => {
        if (!key) return <div key={`pad-${i}`} style={{ background: token.colorFillQuaternary, borderTop: i < 7 ? undefined : border, borderRight: border }} />;
        const list = byDay.get(key) ?? [];
        const isSelected = key === selected;
        return (
          <div
            key={key}
            onClick={() => onSelect(key)}
            style={{
              minHeight: 104, padding: 4, cursor: "pointer", borderRight: border, borderTop: border,
              background: isSelected ? token.colorPrimaryBg : undefined,
              outline: isSelected ? `2px solid ${token.colorPrimary}` : undefined, outlineOffset: -2,
            }}
          >
            <DayNumber day={dayjs(key).date()} isToday={key === today} />
            {list.slice(0, MAX_CHIPS).map((c) => <Chip key={c.id} campaign={c} onOpen={onOpen} />)}
            {list.length > MAX_CHIPS && <div style={{ fontSize: 11, color: token.colorTextSecondary, paddingLeft: 4 }}>+{list.length - MAX_CHIPS} more</div>}
          </div>
        );
      })}
    </div>
  );
}

function DayNumber({ day, isToday }: { day: number; isToday: boolean }) {
  const { token } = theme.useToken();
  return (
    <div style={{ marginBottom: 2 }}>
      <span style={{
        display: "inline-block", minWidth: 22, textAlign: "center", fontSize: 12, borderRadius: 11,
        ...(isToday ? { background: token.colorPrimary, color: "#fff", fontWeight: 600 } : { color: token.colorTextSecondary }),
      }}>{day}</span>
    </div>
  );
}

function Chip({ campaign, onOpen }: { campaign: Campaign; onOpen: (c: Campaign) => void }) {
  const color = campaignColor(campaign);
  return (
    <div
      title={campaign.title}
      onClick={(e) => { e.stopPropagation(); onOpen(campaign); }}
      style={{
        borderLeft: `3px solid ${color}`, background: `${color}${isUnconfirmed(campaign) ? "14" : "30"}`, opacity: isUnconfirmed(campaign) ? 0.7 : 1,
        borderRadius: 3, padding: "1px 4px", marginBottom: 2, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}
    >
      {campaign.brand.name}
    </div>
  );
}
