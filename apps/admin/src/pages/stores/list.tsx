import { List, useTable, EditButton, ShowButton } from "@refinedev/antd";
import { Table, Tag } from "antd";

export const StoreList = () => {
  const { tableProps } = useTable({ resource: "stores" });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column dataIndex="slug" title="Slug" />
        <Table.Column dataIndex="address" title="Address" />
        <Table.Column
          dataIndex="status"
          title="Status"
          render={(value: string) => (
            <Tag color={value === "ACTIVE" ? "green" : value === "PENDING" ? "orange" : "red"}>
              {value}
            </Tag>
          )}
        />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <>
              <EditButton hideText size="small" recordItemId={record.id} />
              <ShowButton hideText size="small" recordItemId={record.id} />
            </>
          )}
        />
      </Table>
    </List>
  );
};
