import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Form, Input, Space } from "antd";
import type { HttpError } from "@refinedev/core";

export const OrganizationList = () => {
  const { tableProps, searchFormProps } = useTable<
    { id: string; name: string; slug: string },
    HttpError,
    { q: string }
  >({
    resource: "organizations",
    onSearch: (values) => [{ field: "q", operator: "contains", value: values.q }],
  });

  return (
    <List>
      <Form {...searchFormProps} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="q" noStyle>
          <Input.Search placeholder="Search organizations..." allowClear onSearch={searchFormProps.form?.submit} style={{ width: 300 }} />
        </Form.Item>
      </Form>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column dataIndex="slug" title="Slug" />
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
