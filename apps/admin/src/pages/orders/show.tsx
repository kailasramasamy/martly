import { Show } from "@refinedev/antd";
import { useShow } from "@refinedev/core";
import { Typography, Tag, Table } from "antd";

const { Title, Text } = Typography;

export const OrderShow = () => {
  const { query } = useShow({ resource: "orders" });
  const record = query?.data?.data;

  if (!record) return null;

  const statusColorMap: Record<string, string> = {
    PENDING: "orange",
    CONFIRMED: "blue",
    PREPARING: "cyan",
    READY: "geekblue",
    DELIVERED: "green",
    CANCELLED: "red",
  };

  return (
    <Show>
      <Title level={5}>Order ID</Title>
      <Text>{record.id}</Text>

      <Title level={5}>Status</Title>
      <Tag color={statusColorMap[record.status] ?? "default"}>{record.status}</Tag>

      <Title level={5}>Payment Status</Title>
      <Tag color={record.paymentStatus === "PAID" ? "green" : record.paymentStatus === "FAILED" ? "red" : "orange"}>
        {record.paymentStatus}
      </Tag>

      <Title level={5}>Total Amount</Title>
      <Text>${record.totalAmount}</Text>

      <Title level={5}>Delivery Address</Title>
      <Text>{record.deliveryAddress}</Text>

      <Title level={5}>Items</Title>
      <Table
        dataSource={record.items ?? []}
        rowKey="id"
        pagination={false}
        columns={[
          { title: "Product ID", dataIndex: "productId", key: "productId" },
          { title: "Quantity", dataIndex: "quantity", key: "quantity" },
          {
            title: "Unit Price",
            dataIndex: "unitPrice",
            key: "unitPrice",
            render: (v: number) => `$${v}`,
          },
          {
            title: "Total",
            dataIndex: "totalPrice",
            key: "totalPrice",
            render: (v: number) => `$${v}`,
          },
        ]}
      />
    </Show>
  );
};
