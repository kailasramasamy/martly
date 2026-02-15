import { List, useTable, ShowButton } from "@refinedev/antd";
import { Table, Tag } from "antd";

export const OrderList = () => {
  const { tableProps } = useTable({ resource: "orders" });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="id" title="Order ID" render={(v: string) => v.slice(0, 8)} />
        <Table.Column dataIndex="totalAmount" title="Total" render={(v: number) => `$${v}`} />
        <Table.Column
          dataIndex="status"
          title="Status"
          render={(value: string) => {
            const colorMap: Record<string, string> = {
              PENDING: "orange", CONFIRMED: "blue", PREPARING: "cyan",
              READY: "geekblue", DELIVERED: "green", CANCELLED: "red",
            };
            return <Tag color={colorMap[value] ?? "default"}>{value}</Tag>;
          }}
        />
        <Table.Column
          dataIndex="paymentStatus"
          title="Payment"
          render={(value: string) => (
            <Tag color={value === "PAID" ? "green" : value === "FAILED" ? "red" : "orange"}>
              {value}
            </Tag>
          )}
        />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <ShowButton hideText size="small" recordItemId={record.id} />
          )}
        />
      </Table>
    </List>
  );
};
