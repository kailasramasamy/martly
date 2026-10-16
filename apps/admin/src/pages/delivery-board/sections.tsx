import type { ReactNode } from "react";
import { Badge, Button, Table, theme as antTheme } from "antd";
import type { TableColumnsType } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import { ConfirmFinalStep } from "../../components/ConfirmFinalStep";

interface SectionOrder {
  id: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
}

export function SectionHeader({ title, count, color, hint }: { title: string; count: number; color: string; hint?: string }) {
  const { token } = antTheme.useToken();
  return (
    <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 14, color: token.colorText }}>{title}</span>
      <Badge count={count} style={{ backgroundColor: color }} size="small" />
      {hint && <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{hint}</span>}
    </div>
  );
}

interface BoardSectionProps<T extends SectionOrder> {
  title: string;
  hint?: string;
  color: string;
  orders: T[];
  columns: TableColumnsType<T>;
  rowSelection?: Parameters<typeof Table<T>>[0]["rowSelection"];
}

/** A titled, bordered table section; renders nothing when empty */
export function BoardSection<T extends SectionOrder>({ title, hint, color, orders, columns, rowSelection }: BoardSectionProps<T>) {
  const { token } = antTheme.useToken();
  if (orders.length === 0) return null;
  return (
    <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <SectionHeader title={title} count={orders.length} color={color} hint={hint} />
      <Table<T> dataSource={orders} columns={columns} rowKey="id" size="small" pagination={false} rowSelection={rowSelection} />
    </div>
  );
}

interface NoRiderSectionProps<T extends SectionOrder> {
  orders: T[];
  columns: TableColumnsType<T>;
  updatingOrderId: string | null;
  onDeliver: (order: T) => void;
}

/** Delivery orders already out for delivery but never put on a trip, so they have no rider to mark them delivered */
export function NoRiderSection<T extends SectionOrder>({ orders, columns, updatingOrderId, onDeliver }: NoRiderSectionProps<T>) {
  const actionColumn: TableColumnsType<T>[number] = {
    title: "Action",
    key: "deliver",
    width: 160,
    render: (_: unknown, rec: T): ReactNode => (
      <ConfirmFinalStep status="DELIVERED" label="Mark Delivered" order={rec} onConfirm={() => onDeliver(rec)}>
        {(onClick) => (
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            loading={updatingOrderId === rec.id}
            onClick={onClick}
            style={{ backgroundColor: "#22c55e", borderColor: "#22c55e", fontSize: 12 }}
          >
            Mark Delivered
          </Button>
        )}
      </ConfirmFinalStep>
    ),
  };
  return (
    <BoardSection
      title={"Out for delivery · no rider"}
      hint="Not on a trip, so mark delivered here"
      color="#f97316"
      orders={orders}
      columns={[...columns, actionColumn]}
    />
  );
}
