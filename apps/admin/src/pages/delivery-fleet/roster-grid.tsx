import { Avatar, Card, Tooltip, Typography } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import { sectionTitle } from "../../theme";
import { WEEK_DAYS, groupWindows } from "./types";
import type { FleetRider, RosterSlot, SlotWindow } from "./types";

interface RosterGridProps {
  slots: RosterSlot[];
  riders: FleetRider[];
  onEdit: (window: SlotWindow, day: number) => void;
}

const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function RosterGrid({ slots, riders, onEdit }: RosterGridProps) {
  const windows = groupWindows(slots);
  const byId = new Map(riders.map((r) => [r.id, r]));

  return (
    <Card title={sectionTitle(<CalendarOutlined />, "Weekly roster")}>
      {windows.length === 0 ? (
        <Typography.Text type="secondary">This store has no active time slots yet. Add them under Time Slots.</Typography.Text>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8 }}>Window</th>
                {WEEK_DAYS.map((d) => <th key={d.value} style={{ padding: 8 }}>{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {windows.map((win) => (
                <tr key={win.key}>
                  <td style={{ padding: 8, whiteSpace: "nowrap", fontWeight: 600 }}>{win.startTime}–{win.endTime}</td>
                  {WEEK_DAYS.map((d) => (
                    <RosterCell key={d.value} slot={win.byDay.get(d.value)} byId={byId} onClick={() => onEdit(win, d.value)} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

interface RosterCellProps {
  slot: RosterSlot | undefined;
  byId: Map<string, FleetRider>;
  onClick: () => void;
}

function RosterCell({ slot, byId, onClick }: RosterCellProps) {
  if (!slot) return <td style={{ padding: 8, textAlign: "center", opacity: 0.3 }}>-</td>;
  return (
    <td onClick={onClick} style={{ padding: 8, textAlign: "center", cursor: "pointer" }}>
      {slot.riderIds.length === 0 ? (
        <Typography.Text type="secondary">None</Typography.Text>
      ) : (
        <Avatar.Group size="small" max={{ count: 3 }}>
          {slot.riderIds.map((id) => (
            <Tooltip key={id} title={byId.get(id)?.name}>
              <Avatar>{initials(byId.get(id)?.name ?? "?")}</Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
      )}
    </td>
  );
}
