import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space } from "antd";
import type { HttpError } from "@refinedev/core";

interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export const BrandList = () => {
  const { tableProps } = useTable<BrandRecord, HttpError>({
    resource: "brands",
    sorters: { initial: [{ field: "name", order: "asc" }] },
  });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column dataIndex="slug" title="Slug" />
        <Table.Column
          dataIndex="imageUrl"
          title="Image"
          render={(v: string | null) =>
            v ? <img src={v} alt="" style={{ height: 32, borderRadius: 4 }} /> : "—"
          }
        />
        <Table.Column
          title="Actions"
          render={(_, record: BrandRecord) => (
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
