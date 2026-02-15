import { List, useTable, ShowButton } from "@refinedev/antd";
import { Table, Tag } from "antd";

import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from "../../constants/tag-colors";

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
            const config = ORDER_STATUS_CONFIG[value];
            return <Tag color={config?.color ?? "default"}>{config?.label ?? value}</Tag>;
          }}
        />
        <Table.Column
          dataIndex="paymentStatus"
          title="Payment"
          render={(value: string) => {
            const config = PAYMENT_STATUS_CONFIG[value];
            return <Tag color={config?.color ?? "default"}>{config?.label ?? value}</Tag>;
          }}
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
