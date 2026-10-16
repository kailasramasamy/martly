import { useState } from "react";
import { Button, Card, Popconfirm, Progress, Select, Space, Tag, Tooltip, theme } from "antd";
import { CarOutlined, DownOutlined, UpOutlined } from "@ant-design/icons";
import { TRIP_STATUS_CONFIG } from "../../constants/tag-colors";
import { StopsTable } from "./stops-table";
import { formatTripMetrics, isUnstarted, startBlocker } from "./types";
import type { PlanRider, PlanTrip, TripHandlers } from "./types";

interface TripCardProps {
  trip: PlanTrip;
  riders: PlanRider[];
  moveTargets: PlanTrip[];
  canDispatch: boolean;
  busy: boolean;
  handlers: TripHandlers;
}

function TripTitle({ trip }: { trip: PlanTrip }) {
  const status = TRIP_STATUS_CONFIG[trip.status];
  return (
    <Space size={8} wrap>
      <CarOutlined />
      <span>{trip.areaLabel ?? `Trip ${trip.id.slice(0, 6)}`}</span>
      <Tag color={status?.color}>{status?.label ?? trip.status}</Tag>
    </Space>
  );
}

function RiderPicker({ trip, riders, canDispatch, busy, onAssign }: Pick<TripCardProps, "trip" | "riders" | "canDispatch" | "busy"> & { onAssign: TripHandlers["onAssign"] }) {
  if (!canDispatch || !isUnstarted(trip)) return <span>{trip.rider ? trip.rider.name : "No rider"}</span>;
  const label = (r: PlanRider) => (!trip.riderId && r.id === trip.suggestedRiderId ? `${r.name} (suggested)` : r.name);
  return (
    <Select
      size="small"
      style={{ minWidth: 190 }}
      placeholder="Choose rider"
      value={trip.riderId ?? trip.suggestedRiderId}
      disabled={busy}
      options={riders.map((r) => ({ value: r.id, label: label(r) }))}
      onChange={(riderId) => onAssign(trip.id, riderId)}
    />
  );
}

function TripButtons({ trip, canDispatch, busy, handlers }: Pick<TripCardProps, "trip" | "canDispatch" | "busy" | "handlers">) {
  const blocker = startBlocker(trip);
  if (!canDispatch) return null;
  return (
    <>
      {isUnstarted(trip) && !trip.riderId && trip.suggestedRiderId && (
        <Button size="small" loading={busy} onClick={() => handlers.onAssign(trip.id, trip.suggestedRiderId as string)}>Assign</Button>
      )}
      {trip.status === "CREATED" && (
        <Tooltip title={blocker}>
          <span><Button size="small" type="primary" disabled={!!blocker} loading={busy} onClick={() => handlers.onStart(trip.id)}>Start</Button></span>
        </Tooltip>
      )}
      {isUnstarted(trip) && (
        <Popconfirm title="Cancel this trip?" description="Its orders go back to unplanned." okText="Cancel trip" cancelText="Keep" onConfirm={() => handlers.onCancel(trip.id)}>
          <Button size="small" danger loading={busy}>Cancel</Button>
        </Popconfirm>
      )}
    </>
  );
}

export function TripCard({ trip, riders, moveTargets, canDispatch, busy, handlers }: TripCardProps) {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const packedPercent = trip.stops.length ? Math.round((trip.packed / trip.stops.length) * 100) : 0;

  return (
    <Card
      size="small"
      style={{ borderColor: token.colorBorderSecondary }}
      title={<TripTitle trip={trip} />}
      extra={<span style={{ color: token.colorTextSecondary, fontSize: 13 }}>{formatTripMetrics(trip)}</span>}
    >
      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        <Progress percent={packedPercent} size="small" format={() => `${trip.packed}/${trip.stops.length} packed`} />
        <Space wrap>
          <RiderPicker trip={trip} riders={riders} canDispatch={canDispatch} busy={busy} onAssign={handlers.onAssign} />
          <TripButtons trip={trip} canDispatch={canDispatch} busy={busy} handlers={handlers} />
          <Button size="small" type="link" icon={open ? <UpOutlined /> : <DownOutlined />} onClick={() => setOpen((v) => !v)}>
            {open ? "Hide stops" : "Show stops"}
          </Button>
        </Space>
        {open && <StopsTable trip={trip} moveTargets={moveTargets} canDispatch={canDispatch} handlers={handlers} />}
      </Space>
    </Card>
  );
}
