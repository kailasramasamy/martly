import { List, useTable, EditButton, ShowButton } from "@refinedev/antd";
import { Avatar, Table, Tag, Form, Select, Space } from "antd";
import type { HttpError } from "@refinedev/core";

import { STORE_STATUS_CONFIG } from "../../constants/tag-colors";
import { DebouncedSearch } from "../../components/DebouncedSearch";

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Pending", value: "PENDING" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Closed", value: "CLOSED" },
];

export const StoreList = () => {
  const { tableProps, searchFormProps } = useTable<
    { id: string; name: string; slug: string; address: string; status: string; logoUrl: string | null; brandColor: string | null },
    HttpError,
    { q: string; status: string }
  >({
    resource: "stores",
    pagination: { pageSize: 25 },
    onSearch: (values) => [
      { field: "q", operator: "contains", value: values.q },
      { field: "status", operator: "eq", value: values.status },
    ],
  });

  return (
    <List>
      <Form {...searchFormProps} layout="inline" style={{ marginBottom: 16, gap: 8 }}>
        <Form.Item name="q" noStyle>
          <DebouncedSearch placeholder="Search stores..." onSearch={() => searchFormProps.form?.submit()} style={{ width: 300 }} />
        </Form.Item>
        <Form.Item name="status" noStyle>
          <Select
            placeholder="Filter by status"
            allowClear
            options={STATUS_OPTIONS}
            onChange={searchFormProps.form?.submit}
            style={{ width: 180 }}
          />
        </Form.Item>
      </Form>
      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column
          dataIndex="name"
          title="Name"
          render={(name: string, store: { logoUrl: string | null; brandColor: string | null }) => (
            <Space>
              {store.logoUrl ? (
                <img src={store.logoUrl} alt="" style={{ width: 64, height: 36, objectFit: "contain", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", padding: 2 }} />
              ) : (
                <Avatar shape="square" style={{ width: 64, height: 36, backgroundColor: store.brandColor ?? "#0d9488" }}>{name.slice(0, 1)}</Avatar>
              )}
              {name}
            </Space>
          )}
        />
        <Table.Column dataIndex="slug" title="Slug" />
        <Table.Column dataIndex="address" title="Address" />
        <Table.Column
          dataIndex="status"
          title="Status"
          render={(value: string) => {
            const config = STORE_STATUS_CONFIG[value];
            return <Tag color={config?.color ?? "default"}>{config?.label ?? value}</Tag>;
          }}
        />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <ShowButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
