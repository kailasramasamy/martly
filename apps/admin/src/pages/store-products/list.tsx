import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Tag, Form, Input, Space } from "antd";
import type { HttpError } from "@refinedev/core";

export const StoreProductList = () => {
  const { tableProps, searchFormProps } = useTable<
    { id: string; store: { name: string }; product: { name: string }; price: number; stock: number; isActive: boolean },
    HttpError,
    { q: string }
  >({
    resource: "store-products",
    onSearch: (values) => [{ field: "q", operator: "contains", value: values.q }],
  });

  return (
    <List>
      <Form {...searchFormProps} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="q" noStyle>
          <Input.Search placeholder="Search store products..." allowClear onSearch={searchFormProps.form?.submit} style={{ width: 300 }} />
        </Form.Item>
      </Form>
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
