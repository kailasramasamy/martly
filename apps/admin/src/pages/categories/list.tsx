import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space } from "antd";
import type { HttpError } from "@refinedev/core";

export const CategoryList = () => {
  const { tableProps } = useTable<
    { id: string; name: string; slug: string; parentId: string | null; sortOrder: number },
    HttpError
  >({
    resource: "categories",
  });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column dataIndex="slug" title="Slug" />
        <Table.Column dataIndex="sortOrder" title="Sort Order" />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
