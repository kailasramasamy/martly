import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, Input, Tag, Switch } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { HttpError } from "@refinedev/core";
import { useUpdate } from "@refinedev/core";

interface CollectionRecord {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  _count: { items: number };
}

export const CollectionList = () => {
  const { tableProps, searchFormProps } = useTable<CollectionRecord, HttpError>({
    resource: "collections",
    sorters: { initial: [{ field: "sortOrder", order: "asc" }] },
    onSearch: (values: { q: string }) => [
      { field: "q", operator: "eq", value: values.q },
    ],
  });

  const { mutate: update } = useUpdate();

  return (
    <List>
      <form
        {...searchFormProps}
        onSubmit={searchFormProps.onFinish}
        style={{ marginBottom: 16 }}
      >
        <Input.Search
          placeholder="Search collections..."
          allowClear
          prefix={<SearchOutlined />}
          onSearch={(value) => searchFormProps.onFinish?.({ q: value })}
          onChange={(e) => {
            if (!e.target.value) searchFormProps.onFinish?.({ q: "" });
          }}
          style={{ maxWidth: 360 }}
        />
      </form>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="title" title="Title" />
        <Table.Column dataIndex="subtitle" title="Subtitle" render={(v: string | null) => v || "—"} />
        <Table.Column
          dataIndex={["_count", "items"]}
          title="Products"
          render={(v: number) => <Tag color="blue">{v}</Tag>}
        />
        <Table.Column dataIndex="sortOrder" title="Sort Order" width={100} />
        <Table.Column
          dataIndex="isActive"
          title="Active"
          width={80}
          render={(v: boolean, record: CollectionRecord) => (
            <Switch
              checked={v}
              size="small"
              onChange={(checked) =>
                update({
                  resource: "collections",
                  id: record.id,
                  values: { isActive: checked },
                  mutationMode: "optimistic",
                })
              }
            />
          )}
        />
        <Table.Column
          title="Scope"
          render={(_: unknown, record: CollectionRecord) =>
            record.organizationId ? (
              <Tag color="cyan">{record.organization?.name ?? "Org"}</Tag>
            ) : (
              <Tag color="purple">Global</Tag>
            )
          }
        />
        <Table.Column
          title="Actions"
          render={(_, record: CollectionRecord) => (
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
