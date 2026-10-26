import { List, useTable, EditButton } from "@refinedev/antd";
import { Table, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { HttpError } from "@refinedev/core";
import type { Town } from "@martly/shared/types";
import { DebouncedSearch } from "../../components/DebouncedSearch";

export const TownList = () => {
  const { tableProps, searchFormProps } = useTable<Town, HttpError, { q: string }>({
    resource: "towns",
    sorters: { initial: [{ field: "name", order: "asc" }] },
    pagination: { pageSize: 25 },
    onSearch: (values) => [{ field: "q", operator: "eq", value: values.q }],
  });

  return (
    <List>
      <div style={{ marginBottom: 16 }}>
        <DebouncedSearch
          placeholder="Search towns..."
          prefix={<SearchOutlined />}
          onSearch={(q) => searchFormProps.onFinish?.({ q })}
          style={{ maxWidth: 360 }}
        />
      </div>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column dataIndex="slug" title="Slug" />
        <Table.Column dataIndex="district" title="District" />
        <Table.Column dataIndex="state" title="State" />
        <Table.Column
          title="Actions"
          render={(_, record: Town) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
