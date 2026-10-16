import { useState } from "react";
import { Button, Select, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router";
import { ConfirmFinalStep } from "../../components/ConfirmFinalStep";
import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from "../../constants/tag-colors";
import { FailModal } from "./fail-modal";
import { FailureTag } from "./failure-tag";
import { isUnstarted } from "./types";
import type { PlanTrip, Stop, TripHandlers } from "./types";

interface StopsTableProps {
  trip: PlanTrip;
  /** Other unstarted trips in the wave that a stop can move to */
  moveTargets: PlanTrip[];
  canDispatch: boolean;
  handlers: TripHandlers;
}

const money = (v: string) => `₹${Math.round(Number(v)).toLocaleString("en-IN")}`;

const DETAIL_COLUMNS: ColumnsType<Stop> = [
  { title: "#", dataIndex: "deliverySequence", width: 44, render: (v) => v ?? "-" },
  { title: "Customer", render: (_, s) => <div>{s.user.name}<div style={{ fontSize: 12, opacity: 0.65 }}>{s.user.phone}</div></div> },
  { title: "Address", dataIndex: "deliveryAddress", ellipsis: true, render: (v) => v ?? "-" },
  { title: "Amount", dataIndex: "totalAmount", align: "right", render: money },
  {
    title: "Payment",
    render: (_, s) => (
      <Space size={4}>
        <Tag>{s.paymentMethod}</Tag>
        <Tag color={PAYMENT_STATUS_CONFIG[s.paymentStatus]?.color}>{PAYMENT_STATUS_CONFIG[s.paymentStatus]?.label ?? s.paymentStatus}</Tag>
      </Space>
    ),
  },
  {
    title: "Status",
    dataIndex: "status",
    render: (v, s) => (
      <Space size={4} wrap>
        <Tag color={ORDER_STATUS_CONFIG[v]?.color}>{ORDER_STATUS_CONFIG[v]?.label ?? v}</Tag>
        <FailureTag failure={s.deliveryFailures?.[0]} />
      </Space>
    ),
  },
];

interface StopActionsProps extends StopsTableProps {
  stop: Stop;
  onFailClick: (stop: Stop) => void;
}

function StopActions({ trip, stop, moveTargets, canDispatch, handlers, onFailClick }: StopActionsProps) {
  const navigate = useNavigate();
  const onTheRoad = canDispatch && trip.status === "IN_PROGRESS" && stop.status === "OUT_FOR_DELIVERY";

  return (
    <Space size={4} wrap>
      {canDispatch && isUnstarted(trip) && (
        <>
          <Select
            size="small"
            placeholder="Move to trip"
            style={{ width: 150 }}
            value={null}
            options={moveTargets.map((t) => ({ value: t.id, label: t.areaLabel ?? `Trip ${t.id.slice(0, 6)}` }))}
            onChange={(toTripId) => handlers.onMove(trip.id, stop.id, toTripId)}
          />
          <Button size="small" onClick={() => handlers.onMove(trip.id, stop.id, null)}>Unplan</Button>
        </>
      )}
      {onTheRoad && (
        <>
          <ConfirmFinalStep status="DELIVERED" label="Mark delivered" order={stop} onConfirm={() => handlers.onDeliver(stop.id)}>
            {(onClick) => <Button size="small" type="primary" onClick={onClick}>Delivered</Button>}
          </ConfirmFinalStep>
          <Button size="small" danger onClick={() => onFailClick(stop)}>Couldn't deliver</Button>
        </>
      )}
      <Button size="small" type="link" onClick={() => navigate(`/orders/show/${stop.id}`)}>Open order</Button>
    </Space>
  );
}

export function StopsTable(props: StopsTableProps) {
  const [failing, setFailing] = useState<Stop | null>(null);
  const columns: ColumnsType<Stop> = [
    ...DETAIL_COLUMNS,
    { title: "", width: 380, render: (_, stop) => <StopActions {...props} stop={stop} onFailClick={setFailing} /> },
  ];

  return (
    <>
      <Table rowKey="id" size="small" columns={columns} dataSource={props.trip.stops} pagination={false} scroll={{ x: 1000 }} />
      <FailModal
        stop={failing}
        onSubmit={(orderId, reason, note) => props.handlers.onFail(props.trip.id, orderId, reason, note)}
        onClose={() => setFailing(null)}
      />
    </>
  );
}
