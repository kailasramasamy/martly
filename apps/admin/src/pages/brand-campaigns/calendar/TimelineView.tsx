import { useMemo } from "react";
import { Tooltip, theme } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { BrandCampaignStatusLabels } from "@martly/shared/constants";
import type { Campaign } from "../types";
import { assignLanes, isUnconfirmed } from "./calendar-data";
import { campaignColor } from "./package-colors";

const DAY_W = 32;
const LABEL_W = 160;
const LANE_H = 26;
const HEADER_H = 36;

interface Props {
  month: Dayjs;
  campaigns: Campaign[];
  onOpen: (c: Campaign) => void;
}

export function TimelineView({ month, campaigns, onOpen }: Props) {
  const { token } = theme.useToken();
  const days = month.daysInMonth();
  const rows = useMemo(() => {
    const names = [...new Set(campaigns.map((c) => c.product.name))].sort();
    return names.map((name) => ({ name, ...assignLanes(campaigns.filter((c) => c.product.name === name), month) }));
  }, [campaigns, month]);
  const todayCol = dayjs().isSame(month, "month") ? dayjs().date() : null;
  const border = `1px solid ${token.colorBorderSecondary}`;
  const dayLeft = (d: number) => (d - 1) * DAY_W;

  // Weekend shading and the today line sit behind the bars, spanning the row
  const backdrop = Array.from({ length: days }, (_, i) => {
    const d = month.date(i + 1);
    return { day: i + 1, weekend: d.day() === 0 || d.day() === 6 };
  });

  return (
    <div style={{ overflowX: "auto", border, borderRadius: token.borderRadius }}>
      <div style={{ width: LABEL_W + days * DAY_W, minWidth: "100%" }}>
        <div style={{ display: "flex", height: HEADER_H, borderBottom: border, background: token.colorFillQuaternary }}>
          <div style={{ width: LABEL_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 3, background: token.colorBgContainer, borderRight: border }} />
          <div style={{ position: "relative", flex: 1 }}>
            {backdrop.map(({ day, weekend }) => (
              <div key={day} style={{ position: "absolute", left: dayLeft(day), width: DAY_W, textAlign: "center", fontSize: 11, lineHeight: `${HEADER_H}px`, color: weekend ? token.colorTextTertiary : token.colorTextSecondary, fontWeight: day === todayCol ? 700 : 400 }}>{day}</div>
            ))}
          </div>
        </div>
        {rows.map((row) => (
          <div key={row.name} style={{ display: "flex", borderBottom: border }}>
            <div style={{ width: LABEL_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 3, background: token.colorBgContainer, borderRight: border, padding: "8px 10px", fontSize: 13, fontWeight: 500 }}>{row.name}</div>
            <div style={{ position: "relative", flex: 1, height: row.laneCount * LANE_H + 8 }}>
              {backdrop.filter((b) => b.weekend).map(({ day }) => (
                <div key={day} style={{ position: "absolute", top: 0, bottom: 0, left: dayLeft(day), width: DAY_W, background: token.colorFillQuaternary }} />
              ))}
              {todayCol && <div style={{ position: "absolute", top: 0, bottom: 0, left: dayLeft(todayCol) + DAY_W / 2, width: 2, background: token.colorPrimary, opacity: 0.6 }} />}
              {row.bars.map((b) => <BarItem key={b.campaign.id} bar={b} onOpen={onOpen} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarItem({ bar, onOpen }: { bar: { campaign: Campaign; from: number; to: number; lane: number }; onOpen: (c: Campaign) => void }) {
  const { campaign: c } = bar;
  const color = campaignColor(c);
  const tip = (
    <div>
      <div>{c.title}</div>
      <div>{BrandCampaignStatusLabels[c.status]}</div>
      <div>{dayjs(c.startsAt).format("D MMM HH:mm")} – {dayjs(c.endsAt).format("D MMM HH:mm")}</div>
    </div>
  );
  return (
    <Tooltip title={tip}>
      <div
        onClick={() => onOpen(c)}
        style={{
          position: "absolute", top: 4 + bar.lane * LANE_H, height: LANE_H - 4, left: (bar.from - 1) * DAY_W + 1, width: (bar.to - bar.from + 1) * DAY_W - 2,
          background: color, opacity: isUnconfirmed(c) ? 0.55 : 1, color: "#fff", borderRadius: 4, padding: "0 6px", fontSize: 12, lineHeight: `${LANE_H - 4}px`,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", zIndex: 1,
        }}
      >
        {c.brand.name}
      </div>
    </Tooltip>
  );
}
