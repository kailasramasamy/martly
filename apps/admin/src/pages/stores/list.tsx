import { List, useTable, EditButton, ShowButton } from "@refinedev/antd";
import { Table, Tag, Form, Input, Space } from "antd";
import type { HttpError } from "@refinedev/core";

export const StoreList = () => {
  const { tableProps, searchFormProps } = useTable<
    { id: string; name: string; slug: string; address: string; status: string },
    HttpError,
    { q: string }
  >({
    resource: "stores",
    onSearch: (values) => [{ field: "q", operator: "contains", value: values.q }],
  });

  return (
    <List>
      <Form {...searchFormProps} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="q" noStyle>
          <Input.Search placeholder="Search stores..." allowClear onSearch={searchFormProps.form?.submit} style={{ width: 300 }} />
        </Form.Item>
      </Form>
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
