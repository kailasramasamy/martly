import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Tag } from "antd";

export const StoreProductList = () => {
  const { tableProps } = useTable({ resource: "store-products" });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex={["store", "name"]} title="Store" />
        <Table.Column dataIndex={["product", "name"]} title="Product" />
        <Table.Column dataIndex="price" title="Price" render={(value) => `$${Number(value).toFixed(2)}`} />
        <Table.Column dataIndex="stock" title="Stock" />
        <Table.Column
          dataIndex="isActive"
          title="Active"
          render={(value) => <Tag color={value ? "green" : "red"}>{value ? "Active" : "Inactive"}</Tag>}
        />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </>
          )}
        />
      </Table>
    </List>
  );
};
