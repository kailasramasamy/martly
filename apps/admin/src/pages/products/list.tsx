import { List, useTable, EditButton, ShowButton } from "@refinedev/antd";
import { Table } from "antd";

export const ProductList = () => {
  const { tableProps } = useTable({ resource: "products" });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column dataIndex="sku" title="SKU" />
        <Table.Column dataIndex="description" title="Description" />
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
