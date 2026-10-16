import { Button, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router";
import { ORDER_STATUS_CONFIG } from "../../constants/tag-colors";
import { FailureTag } from "./failure-tag";
import type { Stop } from "./types";

const money = (v: string) => `₹${Math.round(Number(v)).toLocaleString("en-IN")}`;

export function PoolTable({ orders }: { orders: Stop[] }) {
  const navigate = useNavigate();
  const columns: ColumnsType<Stop> = [
    { title: "Order", dataIndex: "id", render: (v: string) => `#${v.slice(0, 8)}` },
    { title: "Customer", render: (_, s) => <div>{s.user.name}<div style={{ fontSize: 12, opacity: 0.65 }}>{s.user.phone}</div></div> },
    { title: "Address", dataIndex: "deliveryAddress", ellipsis: true, render: (v) => v ?? "-" },
    { title: "Items", render: (_, s) => s._count.items },
    { title: "Amount", dataIndex: "totalAmount", align: "right", render: money },
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
    { title: "", render: (_, s) => <Button size="small" type="link" onClick={() => navigate(`/orders/show/${s.id}`)}>Open order</Button> },
  ];
  return <Table rowKey="id" size="small" columns={columns} dataSource={orders} pagination={false} scroll={{ x: 800 }} />;
}
